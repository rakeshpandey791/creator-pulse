import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const explore = readFileSync("apps/web/app/app/explore/page.tsx", "utf8");
const workspace = readFileSync(
  "apps/web/app/app/ideas/[ideaId]/script/page.tsx",
  "utf8",
);

describe("FE-08 tomorrow-script journey", () => {
  it("offers both recommended and own-topic entry paths", () => {
    expect(explore).toContain("Use a recommended idea");
    expect(explore).toContain("Start with my own topic");
    expect(explore).toContain("What do you want to record tomorrow?");
  });

  it("explains the creator output and completion state", () => {
    expect(explore).toContain("three hooks, a spoken script and a CTA");
    expect(workspace).toContain("Create tomorrow’s draft");
    expect(workspace).toContain("Mark ready for tomorrow");
    expect(workspace).toContain("We’re turning your idea into a script");
  });

  it("persists the ready-for-tomorrow status through the existing API", () => {
    expect(workspace).toContain(
      'discoveryApi.updateStatus(token, idea.id, "planned")',
    );
    expect(workspace).toContain(
      'discoveryApi.updateStatus(token, idea.id, "scripted")',
    );
  });
});
