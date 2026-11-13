export const LANGUAGE_CODES = [
  "hi",
  "hinglish",
  "bho",
  "pa",
  "bgc",
  "te",
  "kn",
] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];
export type LanguageScript =
  "Devanagari" | "Latin" | "Gurmukhi" | "Telugu" | "Kannada";

export type LanguageMetadata = {
  id: string;
  code: LanguageCode;
  name: string;
  nativeName: string;
  dialect: string;
  script: LanguageScript;
  aliases: readonly string[];
  supportsControlledCodeSwitching: boolean;
  promptGuidance: string;
};

export const LANGUAGE_CATALOG: readonly LanguageMetadata[] = [
  {
    id: "6f4e5c8b-3f7b-4f2a-9b31-000000000001",
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    dialect: "Standard Hindi",
    script: "Devanagari",
    aliases: ["hindi", "hin", "hi-in"],
    supportsControlledCodeSwitching: true,
    promptGuidance:
      "Write natural conversational Hindi in Devanagari. Keep creator-native phrasing and avoid literal English translations.",
  },
  {
    id: "6f4e5c8b-3f7b-4f2a-9b31-000000000002",
    code: "hinglish",
    name: "Hinglish",
    nativeName: "Hinglish",
    dialect: "Hindi-English code-switching",
    script: "Latin",
    aliases: ["hinglish", "hi-latn", "roman hindi"],
    supportsControlledCodeSwitching: true,
    promptGuidance:
      "Write natural Hinglish with intentional Hindi-English code-switching in Latin script. Do not translate every phrase into formal English.",
  },
  {
    id: "6f4e5c8b-3f7b-4f2a-9b31-000000000003",
    code: "bho",
    name: "Bhojpuri",
    nativeName: "भोजपुरी",
    dialect: "Bhojpuri",
    script: "Devanagari",
    aliases: ["bhojpuri", "bho"],
    supportsControlledCodeSwitching: false,
    promptGuidance:
      "Write idiomatic Bhojpuri in Devanagari, preserving respectful local phrasing and avoiding Hindi-only substitutions.",
  },
  {
    id: "6f4e5c8b-3f7b-4f2a-9b31-000000000004",
    code: "pa",
    name: "Punjabi",
    nativeName: "ਪੰਜਾਬੀ",
    dialect: "Punjabi",
    script: "Gurmukhi",
    aliases: ["punjabi", "panjabi", "pa-in"],
    supportsControlledCodeSwitching: false,
    promptGuidance:
      "Write natural Punjabi in Gurmukhi with creator-friendly rhythm; do not transliterate it into Hindi or English.",
  },
  {
    id: "6f4e5c8b-3f7b-4f2a-9b31-000000000005",
    code: "bgc",
    name: "Haryanvi",
    nativeName: "हरियाणवी",
    dialect: "Haryanvi",
    script: "Devanagari",
    aliases: ["haryanvi", "harayanvi", "bgc"],
    supportsControlledCodeSwitching: false,
    promptGuidance:
      "Write natural Haryanvi in Devanagari with locally recognizable tone and vocabulary, not generic Hindi.",
  },
  {
    id: "6f4e5c8b-3f7b-4f2a-9b31-000000000006",
    code: "te",
    name: "Telugu",
    nativeName: "తెలుగు",
    dialect: "Telugu",
    script: "Telugu",
    aliases: ["telugu", "te-in"],
    supportsControlledCodeSwitching: false,
    promptGuidance:
      "Write natural Telugu in Telugu script and preserve concise spoken phrasing suited to short-form video.",
  },
  {
    id: "6f4e5c8b-3f7b-4f2a-9b31-000000000007",
    code: "kn",
    name: "Kannada",
    nativeName: "ಕನ್ನಡ",
    dialect: "Kannada",
    script: "Kannada",
    aliases: ["kannada", "kn-in"],
    supportsControlledCodeSwitching: false,
    promptGuidance:
      "Write natural Kannada in Kannada script with clear spoken phrasing and no silent English fallback.",
  },
] as const;

const languageLookup = new Map<string, LanguageMetadata>();
for (const language of LANGUAGE_CATALOG) {
  for (const value of [
    language.id,
    language.code,
    language.name,
    language.nativeName,
    ...language.aliases,
  ])
    languageLookup.set(value.trim().toLocaleLowerCase("en-US"), language);
}

export class UnsupportedLanguageError extends Error {
  constructor(value: string) {
    super(`Unsupported language: ${value}`);
    this.name = "UnsupportedLanguageError";
  }
}

export function getLanguage(value: string): LanguageMetadata | null {
  return languageLookup.get(value.trim().toLocaleLowerCase("en-US")) ?? null;
}

export function normalizeLanguageId(value: string): LanguageCode {
  const language = getLanguage(value);
  if (!language) throw new UnsupportedLanguageError(value);
  return language.code;
}

export function isSupportedLanguageIdentifier(value: unknown): value is string {
  return typeof value === "string" && getLanguage(value) !== null;
}

export type LanguageSelection = {
  requested: LanguageCode | null;
  selected: LanguageCode | null;
  usedProfileFallback: boolean;
};

export function resolveLanguageSelection(input: {
  requestedLanguage?: string;
  profileLanguages?: readonly string[];
}): LanguageSelection {
  if (input.requestedLanguage?.trim()) {
    return {
      requested: normalizeLanguageId(input.requestedLanguage),
      selected: normalizeLanguageId(input.requestedLanguage),
      usedProfileFallback: false,
    };
  }
  const profileLanguage = input.profileLanguages?.find((value) => value.trim());
  return {
    requested: null,
    selected: profileLanguage ? normalizeLanguageId(profileLanguage) : null,
    usedProfileFallback: Boolean(profileLanguage),
  };
}

export type LanguageDetection = {
  language: LanguageCode | "unknown";
  scripts: LanguageScript[];
  confidence: "high" | "medium" | "low";
  mixedLanguage: boolean;
  scriptMismatch: boolean;
};

export function detectLanguage(
  text: string,
  expectedLanguage?: string,
): LanguageDetection {
  const scripts = detectScripts(text);
  const words = new Set(
    text
      .toLocaleLowerCase("en-US")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
  let language: LanguageDetection["language"] = "unknown";
  let confidence: LanguageDetection["confidence"] = "low";
  if (scripts.includes("Gurmukhi")) {
    language = "pa";
    confidence = "high";
  } else if (scripts.includes("Telugu")) {
    language = "te";
    confidence = "high";
  } else if (scripts.includes("Kannada")) {
    language = "kn";
    confidence = "high";
  } else if (
    scripts.includes("Latin") &&
    ["aaj", "kaise", "hai", "ho", "kya", "mera", "apna", "liye", "nahi"].some(
      (word) => words.has(word),
    )
  ) {
    language = "hinglish";
    confidence = "medium";
  } else if (scripts.includes("Devanagari")) {
    const bhojpuriMarkers = ["रउआ", "बानी", "हमनी", "कइसन", "भोजपुरी"];
    const haryanviMarkers = ["सै", "कोनी", "थारे", "मन्नै", "के हाल"];
    if (bhojpuriMarkers.some((marker) => text.includes(marker)))
      language = "bho";
    else if (haryanviMarkers.some((marker) => text.includes(marker)))
      language = "bgc";
    else language = "hi";
    confidence = "medium";
  }
  const expected = expectedLanguage
    ? normalizeLanguageId(expectedLanguage)
    : null;
  const expectedMetadata = expected ? getLanguage(expected) : null;
  return {
    language,
    scripts,
    confidence,
    mixedLanguage: scripts.length > 1 || language === "hinglish",
    scriptMismatch: Boolean(
      expectedMetadata && !scripts.includes(expectedMetadata.script),
    ),
  };
}

function detectScripts(text: string): LanguageScript[] {
  const scripts: LanguageScript[] = [];
  if (/[A-Za-z]/.test(text)) scripts.push("Latin");
  if (/[\u0900-\u097F]/u.test(text)) scripts.push("Devanagari");
  if (/[\u0A00-\u0A7F]/u.test(text)) scripts.push("Gurmukhi");
  if (/[\u0C00-\u0C7F]/u.test(text)) scripts.push("Telugu");
  if (/[\u0C80-\u0CFF]/u.test(text)) scripts.push("Kannada");
  return scripts;
}

export function buildLanguagePromptContext(input: {
  language: string;
  platform: string;
  fallback: "explicit_choice_only";
}) {
  const language = getLanguage(input.language);
  if (!language) throw new UnsupportedLanguageError(input.language);
  return {
    language: language.code,
    languageName: language.name,
    dialect: language.dialect,
    script: language.script,
    platform: input.platform,
    fallback: input.fallback,
    instructions: `${language.promptGuidance} Keep the selected platform context: ${input.platform}. Never silently substitute another language; ask for an explicit fallback choice.`,
    policyVersion: "lang-01-v1",
  } as const;
}
