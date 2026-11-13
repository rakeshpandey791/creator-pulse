import { describe, expect, it } from "vitest";
import {
  LANGUAGE_CATALOG,
  buildLanguagePromptContext,
  detectLanguage,
  normalizeLanguageId,
  resolveLanguageSelection,
} from "@creator-pulse/contracts";

describe("LANG-01 language contract", () => {
  it("defines metadata for every launch language", () => {
    expect(LANGUAGE_CATALOG).toHaveLength(7);
    expect(LANGUAGE_CATALOG.map((language) => language.code)).toEqual([
      "hi",
      "hinglish",
      "bho",
      "pa",
      "bgc",
      "te",
      "kn",
    ]);
    for (const language of LANGUAGE_CATALOG) {
      expect(language.id).toMatch(/^6f4e5c8b-3f7b-4f2a-9b31-/);
      expect(language.dialect).toBeTruthy();
      expect(language.promptGuidance).toBeTruthy();
    }
  });

  it("normalizes aliases and rejects unsupported languages", () => {
    expect(normalizeLanguageId("हिन्दी")).toBe("hi");
    expect(normalizeLanguageId("6f4e5c8b-3f7b-4f2a-9b31-000000000007")).toBe(
      "kn",
    );
    expect(() => normalizeLanguageId("en")).toThrow("Unsupported language: en");
  });

  it("gives an explicit request precedence over profile languages", () => {
    expect(
      resolveLanguageSelection({
        requestedLanguage: "te",
        profileLanguages: ["hi", "kn"],
      }),
    ).toEqual({ requested: "te", selected: "te", usedProfileFallback: false });
    expect(resolveLanguageSelection({ profileLanguages: ["pa"] })).toEqual({
      requested: null,
      selected: "pa",
      usedProfileFallback: true,
    });
  });

  it.each([
    ["hi", "नमस्ते, आज आपका दिन कैसा है?", "Devanagari"],
    ["hinglish", "Aaj ka idea solid hai", "Latin"],
    ["bho", "रउआ कइसन बानी?", "Devanagari"],
    ["pa", "ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?", "Gurmukhi"],
    ["bgc", "राम राम, के हाल सै?", "Devanagari"],
    ["te", "మీరు ఎలా ఉన్నారు?", "Telugu"],
    ["kn", "ನೀವು ಹೇಗಿದ್ದೀರಿ?", "Kannada"],
  ])("detects %s", (expected, text, script) => {
    const result = detectLanguage(text, expected);
    expect(result.language).toBe(expected);
    expect(result.scripts).toContain(script);
    expect(result.scriptMismatch).toBe(false);
  });

  it("flags mixed-language and script mismatch output", () => {
    expect(detectLanguage("Aaj ka idea solid hai", "hinglish")).toMatchObject({
      language: "hinglish",
      mixedLanguage: true,
      scriptMismatch: false,
    });
    expect(detectLanguage("Aaj ka idea अच्छा है", "hinglish")).toMatchObject({
      language: "hinglish",
      mixedLanguage: true,
      scriptMismatch: false,
    });
    expect(detectLanguage("नमस्ते आपका स्वागत है", "pa").scriptMismatch).toBe(
      true,
    );
  });

  it("preserves selected language and platform in generation context", () => {
    expect(
      buildLanguagePromptContext({
        language: "bho",
        platform: "youtube",
        fallback: "explicit_choice_only",
      }),
    ).toMatchObject({
      language: "bho",
      dialect: "Bhojpuri",
      platform: "youtube",
      fallback: "explicit_choice_only",
      policyVersion: "lang-01-v1",
    });
  });
});
