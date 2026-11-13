import { createHash } from "node:crypto";

export const SOURCE_TYPES = [
  "official_api",
  "rss",
  "public_web",
  "manual_seed",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const RETRIEVAL_STATUSES = [
  "active",
  "stale",
  "blocked",
  "failed",
] as const;
export type RetrievalStatus = (typeof RETRIEVAL_STATUSES)[number];

export type SourceAdapterErrorCode =
  "malformed" | "rate_limited" | "timeout" | "unavailable" | "forbidden";

export class SourceAdapterError extends Error {
  constructor(
    public readonly code: SourceAdapterErrorCode,
    message: string,
    public readonly retryable: boolean,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "SourceAdapterError";
  }
}

export type NormalizedSourceDocument = {
  _id: string;
  sourceType: SourceType;
  sourceName: string;
  canonicalUrl: string;
  title?: string;
  excerpt?: string;
  languageId?: string;
  publishedAt?: Date | null;
  observedAt: Date;
  rawContentHash: string;
  retrievalStatus: RetrievalStatus;
  licenseNote?: string;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SourceFetchContext = {
  now?: Date;
  signal?: AbortSignal;
};

export interface SourceAdapter {
  readonly name: string;
  readonly sourceType: SourceType;
  fetch(context?: SourceFetchContext): Promise<NormalizedSourceDocument[]>;
}

export type ManualSeedItem = {
  url: string;
  title: string;
  excerpt?: string;
  languageId?: string;
  publishedAt?: Date | null;
  licenseNote?: string;
};

export class ManualSeedSourceAdapter implements SourceAdapter {
  readonly sourceType = "manual_seed" as const;

  constructor(
    public readonly name: string,
    private readonly items: readonly ManualSeedItem[],
  ) {}

  async fetch(context: SourceFetchContext = {}) {
    const now = context.now ?? new Date();
    return this.items.map((item) =>
      normalizeDocument(
        {
          ...item,
          sourceType: this.sourceType,
          sourceName: this.name,
          retrievalStatus: "active",
        },
        now,
      ),
    );
  }
}

export type RssSourceAdapterOptions = {
  sourceName: string;
  feedUrl: string;
  licenseNote?: string;
  maxItems?: number;
  fetchImpl?: typeof fetch;
};

export class RssSourceAdapter implements SourceAdapter {
  readonly sourceType = "rss" as const;
  private readonly fetchImpl: typeof fetch;
  private readonly maxItems: number;

  constructor(private readonly options: RssSourceAdapterOptions) {
    assertHttpUrl(options.feedUrl, "RSS feed URL");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxItems = Math.min(Math.max(options.maxItems ?? 25, 1), 100);
  }

  get name() {
    return this.options.sourceName;
  }

  async fetch(context: SourceFetchContext = {}) {
    const now = context.now ?? new Date();
    let response: Response;
    try {
      response = await this.fetchImpl(this.options.feedUrl, {
        method: "GET",
        headers: {
          Accept:
            "application/rss+xml, application/atom+xml, application/xml, text/xml",
        },
        signal: context.signal,
      });
    } catch (cause) {
      const code = isAbortError(cause) ? "timeout" : "unavailable";
      throw new SourceAdapterError(
        code,
        `Could not fetch RSS source ${this.name}`,
        true,
        { cause },
      );
    }
    if (response.status === 429) {
      throw new SourceAdapterError(
        "rate_limited",
        `RSS source ${this.name} rate limited the request`,
        true,
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new SourceAdapterError(
        "forbidden",
        `RSS source ${this.name} denied access`,
        false,
      );
    }
    if (!response.ok) {
      throw new SourceAdapterError(
        "unavailable",
        `RSS source ${this.name} returned ${response.status}`,
        response.status >= 500,
      );
    }
    const body = await response.text();
    const items = parseFeedItems(body).slice(0, this.maxItems);
    if (items.length === 0) {
      throw new SourceAdapterError(
        "malformed",
        `RSS source ${this.name} contained no usable items`,
        false,
      );
    }
    return items.map((item) =>
      normalizeDocument(
        {
          ...item,
          sourceType: this.sourceType,
          sourceName: this.name,
          licenseNote: this.options.licenseNote,
          retrievalStatus: "active",
        },
        now,
      ),
    );
  }
}

export function deduplicateSourceDocuments(
  documents: readonly NormalizedSourceDocument[],
) {
  const seen = new Set<string>();
  return documents.filter((document) => {
    const key = `${document.canonicalUrl}|${document.rawContentHash}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type DocumentInput = ManualSeedItem & {
  sourceType: SourceType;
  sourceName: string;
  retrievalStatus: RetrievalStatus;
};

function normalizeDocument(
  input: DocumentInput,
  now: Date,
): NormalizedSourceDocument {
  const canonicalUrl = canonicalizeUrl(input.url);
  const title = boundedText(input.title, 300);
  if (!title)
    throw new SourceAdapterError(
      "malformed",
      "Source item title is required",
      false,
    );
  const excerpt = boundedText(input.excerpt, 2000);
  const rawContentHash = sha256(
    [canonicalUrl, title, excerpt ?? ""].join("\n"),
  );
  return {
    _id: sha256(`${input.sourceName}|${canonicalUrl}|${rawContentHash}`).slice(
      0,
      36,
    ),
    sourceType: input.sourceType,
    sourceName: boundedText(input.sourceName, 120) ?? "Unknown source",
    canonicalUrl,
    title,
    ...(excerpt ? { excerpt } : {}),
    ...(input.languageId ? { languageId: input.languageId } : {}),
    publishedAt: input.publishedAt ?? null,
    observedAt: now,
    rawContentHash,
    retrievalStatus: input.retrievalStatus,
    ...(input.licenseNote
      ? { licenseNote: boundedText(input.licenseNote, 500) }
      : {}),
    createdAt: now,
    updatedAt: now,
  };
}

function parseFeedItems(xml: string): ManualSeedItem[] {
  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => match[2])
    .filter((block): block is string => Boolean(block));
  return blocks.flatMap((block) => {
    const title = xmlValue(block, "title");
    const url = xmlValue(block, "link") ?? atomLink(block);
    if (!title || !url) return [];
    const excerpt =
      xmlValue(block, "description") ??
      xmlValue(block, "summary") ??
      xmlValue(block, "content");
    const published =
      xmlValue(block, "pubDate") ??
      xmlValue(block, "published") ??
      xmlValue(block, "updated");
    const publishedAt = published ? new Date(published) : null;
    return [
      {
        title,
        url,
        excerpt,
        publishedAt:
          publishedAt && !Number.isNaN(publishedAt.getTime())
            ? publishedAt
            : null,
      },
    ];
  });
}

function xmlValue(block: string, tag: string) {
  const match = block.match(
    new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
  );
  const value = match?.[1];
  return value ? boundedText(decodeXml(value), 2000) : undefined;
}

function atomLink(block: string) {
  const match = block.match(
    /<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>(?:<\/link>)?/i,
  );
  return match?.[1];
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function boundedText(value: string | undefined, max: number) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

function canonicalizeUrl(value: string) {
  assertHttpUrl(value, "Source URL");
  const url = new URL(value);
  url.hash = "";
  return url.toString();
}

function assertHttpUrl(value: string, label: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SourceAdapterError(
      "malformed",
      `${label} must be a valid HTTP URL`,
      false,
    );
  }
  if (!/^https?:$/.test(url.protocol))
    throw new SourceAdapterError(
      "forbidden",
      `${label} must use HTTP or HTTPS`,
      false,
    );
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isAbortError(cause: unknown) {
  return cause instanceof Error && cause.name === "AbortError";
}
