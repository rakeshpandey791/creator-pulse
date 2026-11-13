import { createHash } from "node:crypto";
import {
  IngestionError,
  type SourceAdapter,
  type SourceDocument,
} from "./ingestion.js";

export class RssSourceAdapter implements SourceAdapter {
  readonly permittedUse: boolean;
  readonly licenseNote: string;
  private readonly maxItems: number;
  private readonly fetchImpl: typeof fetch;

  constructor(
    readonly name: string,
    private readonly feedUrl: string,
    options: {
      permittedUse: boolean;
      licenseNote: string;
      maxItems?: number;
      fetchImpl?: typeof fetch;
    },
  ) {
    if (!/^https?:$/.test(new URL(feedUrl).protocol))
      throw new IngestionError("RSS URL must use HTTP or HTTPS", "forbidden");
    this.permittedUse = options.permittedUse;
    this.licenseNote = options.licenseNote;
    this.maxItems = Math.min(Math.max(options.maxItems ?? 25, 1), 100);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async fetch(context: { now: Date; signal?: AbortSignal }) {
    let response: Response;
    try {
      response = await this.fetchImpl(this.feedUrl, {
        headers: {
          Accept:
            "application/rss+xml, application/atom+xml, application/xml, text/xml",
        },
        signal: context.signal,
      });
    } catch (error) {
      throw new IngestionError(
        "RSS source is unavailable",
        error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : "unavailable",
        true,
      );
    }
    if (response.status === 429)
      throw new IngestionError(
        "RSS source rate limited the request",
        "rate_limited",
        true,
      );
    if (response.status === 401 || response.status === 403)
      throw new IngestionError("RSS source denied access", "forbidden");
    if (!response.ok)
      throw new IngestionError(
        `RSS source returned ${response.status}`,
        "unavailable",
        response.status >= 500,
      );
    const body = await response.text();
    const documents = [
      ...body.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi),
    ]
      .slice(0, this.maxItems)
      .flatMap((match) => this.normalize(match[2] ?? "", context.now));
    if (!documents.length)
      throw new IngestionError(
        "RSS source contained no usable items",
        "malformed",
      );
    return documents;
  }

  private normalize(block: string, now: Date): SourceDocument[] {
    const title = xmlValue(block, "title");
    const url =
      xmlValue(block, "link") ??
      block.match(/<link\b[^>]*href=["']([^"']+)/i)?.[1];
    if (!title || !url) return [];
    const canonicalUrl = new URL(url).toString();
    const excerpt =
      xmlValue(block, "description") ?? xmlValue(block, "summary");
    const publishedText =
      xmlValue(block, "pubDate") ??
      xmlValue(block, "published") ??
      xmlValue(block, "updated");
    const publishedAt = publishedText ? new Date(publishedText) : null;
    const rawContentHash = hash(
      [canonicalUrl, title, excerpt ?? ""].join("\n"),
    );
    return [
      {
        _id: hash(`${this.name}|${canonicalUrl}|${rawContentHash}`).slice(
          0,
          36,
        ),
        sourceType: "rss",
        sourceName: this.name,
        canonicalUrl,
        title,
        ...(excerpt ? { excerpt } : {}),
        publishedAt:
          publishedAt && !Number.isNaN(publishedAt.getTime())
            ? publishedAt
            : null,
        observedAt: now,
        rawContentHash,
        retrievalStatus: "active",
        licenseNote: this.licenseNote,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
}

function xmlValue(block: string, tag: string) {
  const value = block.match(
    new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
  )?.[1];
  if (!value) return undefined;
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
