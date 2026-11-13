import { describe, expect, it } from "vitest";
import type { GenerationOperation, IdeaDetail } from "../apps/web/lib/api";
import {
  assetsFor,
  buildScriptGenerationInput,
  draftStorageKey,
  operationStorageKey,
  shouldApplyGeneratedContent,
} from "../apps/web/lib/script-workspace";

const idea = {
  id: "idea-1",
  title: "A useful idea",
  summary: "A concise summary",
  languageId: "en",
  platformId: "youtube",
  nicheId: "niche-1",
  topicId: "topic-1",
  origin: "research",
  score: null,
  coverage: {
    sourceCount: 1,
    signalCount: 1,
    staleSourceCount: 0,
    missingEvidence: false,
    uncertainty: "none" as const,
  },
  evidence: [],
} satisfies IdeaDetail;

const operation = {
  operationId: "op-1",
  ideaId: "idea-1",
  status: "succeeded" as const,
  requestedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:01.000Z",
  languageId: "en",
  platformId: "youtube",
  promptVersion: "v1",
  attempts: 1,
  assets: [
    {
      _id: "asset-hook",
      assetType: "hook" as const,
      content: "Stop scrolling for one useful idea.",
      languageId: "en",
      platformId: "youtube",
      durationSeconds: 45,
      tone: "clear",
      safetyFlags: [],
      generationId: "op-1",
    },
  ],
} satisfies GenerationOperation;

describe("FE-03 script workspace", () => {
  it("builds the generation request from the idea context", () => {
    expect(buildScriptGenerationInput(idea)).toEqual({
      language: "en",
      platform: "youtube",
      outputs: ["hooks", "script", "cta"],
      durationSeconds: 45,
      tone: "clear, useful and creator-friendly",
    });
  });

  it("passes creator context without weakening the base generation contract", () => {
    expect(
      buildScriptGenerationInput(
        idea,
        "Audience: desk workers who want practical mobility habits. Style: little joyful.",
      ),
    ).toMatchObject({
      language: "en",
      platform: "youtube",
      outputs: ["hooks", "script", "cta"],
      creatorContext:
        "Audience: desk workers who want practical mobility habits. Style: little joyful.",
    });
  });

  it("maps generated hooks and preserves edits during regeneration", () => {
    expect(assetsFor(operation, "hook")).toHaveLength(1);
    expect(assetsFor(operation, "script")).toHaveLength(0);
    expect(shouldApplyGeneratedContent(false)).toBe(true);
    expect(shouldApplyGeneratedContent(true)).toBe(false);
  });

  it("names draft and operation storage per idea", () => {
    expect(draftStorageKey("idea-1")).toBe("creatorpulse.script-draft.idea-1");
    expect(operationStorageKey("idea-1")).toBe(
      "creatorpulse.generation.idea-1",
    );
  });
});
