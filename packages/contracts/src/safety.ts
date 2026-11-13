export const SAFETY_FLAGS = [
  "sensitive_topic",
  "unsupported_claim",
  "financial_guarantee",
  "medical_claim",
  "unsafe_instruction",
  "missing_disclaimer",
  "requires_human_review",
] as const;

export type SafetyFlag = (typeof SAFETY_FLAGS)[number];
export type SafetyDecision = "allow" | "warn" | "review" | "reject";

export type SafetyCheckInput = {
  text: string;
  niche: string;
  language?: string;
  platform?: string;
  sourceClaims?: readonly string[];
};

export type SafetyCheckResult = {
  decision: SafetyDecision;
  flags: SafetyFlag[];
  warnings: string[];
  requiredDisclaimers: string[];
  report: SafetyReport;
};

export type SafetyReport = {
  language?: string;
  platform?: string;
  niche: string;
  decision: SafetyDecision;
  flags: SafetyFlag[];
  warningCount: number;
  sourceClaimCount: number;
};

const SENSITIVE_NICHES = new Map([
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000001", "fitness"],
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000003", "finance"],
  ["fitness", "fitness"],
  ["finance", "finance"],
  ["health", "health"],
  ["medical", "health"],
]);

const CLAIM_PATTERNS = [
  /100\s*%/i,
  /सौ प्रतिशत/u,
  /पक्का/u,
  /guarantee(?:d)?/i,
  /risk[- ]free/i,
  /no doctor/i,
  /डॉक्टर की जरूरत नहीं/u,
];

const UNSAFE_PATTERNS = [
  /stop breathing/i,
  /सांस रोक/u,
  /mix(?:ing)? bleach and ammonia/i,
  /ब्लीच.*अमोनिया/u,
];

export class UnsafeContentError extends Error {
  constructor(message = "Content requires safety review before publication") {
    super(message);
    this.name = "UnsafeContentError";
  }
}

export function evaluateSafety(input: SafetyCheckInput): SafetyCheckResult {
  if (typeof input.text !== "string" || input.text.length > 12_000)
    throw new Error("Safety input text is required and bounded");
  if (
    input.sourceClaims &&
    (input.sourceClaims.length > 5 ||
      input.sourceClaims.some(
        (claim) => typeof claim !== "string" || claim.length > 500,
      ))
  )
    throw new Error(
      "Safety source claims must be at most five bounded strings",
    );
  const niche = normalizeNiche(input.niche);
  const flags = new Set<SafetyFlag>();
  const warnings: string[] = [];
  const requiredDisclaimers: string[] = [];

  if (niche === "finance" || niche === "fitness" || niche === "health") {
    flags.add("sensitive_topic");
    warnings.push(
      niche === "finance"
        ? "Financial information is educational, not personalized financial advice."
        : "Health and fitness information is general education, not personalized medical advice.",
    );
    requiredDisclaimers.push(
      niche === "finance"
        ? "Do your own research and consult a qualified financial professional."
        : "Consult a qualified health professional for personal advice.",
    );
  }
  if (CLAIM_PATTERNS.some((pattern) => pattern.test(input.text))) {
    flags.add("unsupported_claim");
    warnings.push("The output contains an absolute or unsupported claim.");
  }
  if (
    niche === "finance" &&
    /100\s*%|सौ प्रतिशत|guarantee|पक्का/i.test(input.text)
  ) {
    flags.add("financial_guarantee");
    requiredDisclaimers.push(
      "Do not promise returns or present an investment outcome as guaranteed.",
    );
  }
  if (
    (niche === "fitness" || niche === "health") &&
    /cure|इलाज|ठीक कर देगा|no doctor|डॉक्टर की जरूरत नहीं/i.test(input.text)
  ) {
    flags.add("medical_claim");
    requiredDisclaimers.push(
      "Avoid cure claims and direct viewers to a qualified health professional.",
    );
  }
  if (UNSAFE_PATTERNS.some((pattern) => pattern.test(input.text))) {
    flags.add("unsafe_instruction");
    warnings.push(
      "The output contains an unsafe instruction and cannot be published.",
    );
  }
  if (requiredDisclaimers.length > 0 && !hasDisclaimer(input.text, niche))
    flags.add("missing_disclaimer");

  const decision: SafetyDecision = flags.has("unsafe_instruction")
    ? "reject"
    : flags.has("unsupported_claim") ||
        flags.has("financial_guarantee") ||
        flags.has("medical_claim")
      ? "review"
      : flags.has("sensitive_topic") || flags.has("missing_disclaimer")
        ? "warn"
        : "allow";
  if (decision === "review") flags.add("requires_human_review");
  return {
    decision,
    flags: [...flags],
    warnings,
    requiredDisclaimers: [...new Set(requiredDisclaimers)],
    report: {
      ...(input.language ? { language: input.language } : {}),
      ...(input.platform ? { platform: input.platform } : {}),
      niche,
      decision,
      flags: [...flags],
      warningCount: warnings.length,
      sourceClaimCount: input.sourceClaims?.length ?? 0,
    },
  };
}

export function assertSafeToPublish(result: SafetyCheckResult) {
  if (result.decision === "reject" || result.decision === "review")
    throw new UnsafeContentError();
}

function normalizeNiche(value: string) {
  const niche = SENSITIVE_NICHES.get(value.trim().toLocaleLowerCase("en-US"));
  return niche ?? value.trim().toLocaleLowerCase("en-US");
}

function hasDisclaimer(text: string, niche: string) {
  if (niche === "finance")
    return /not financial advice|do your own research|financial professional/i.test(
      text,
    );
  if (niche === "fitness" || niche === "health")
    return /health professional|medical advice|qualified trainer/i.test(text);
  return true;
}
