import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const primitiveSource = readFileSync(
  new URL("../apps/web/components/primitives.tsx", import.meta.url),
  "utf8",
);
const cssSource = readFileSync(
  new URL("../apps/web/app/globals.css", import.meta.url),
  "utf8",
);
const shellSource = readFileSync(
  new URL("../apps/web/components/discovery-ui.tsx", import.meta.url),
  "utf8",
);

describe("FE-06 shared shell and primitive contracts", () => {
  it("exports the shared component vocabulary", () => {
    for (const name of [
      "Button",
      "Panel",
      "StatusPill",
      "ScoreMeter",
      "FilterChips",
      "FormField",
      "Alert",
      "Drawer",
      "Skeleton",
      "EmptyState",
    ]) {
      expect(primitiveSource).toContain(`export function ${name}`);
    }
  });

  it("centralizes Stitch tokens and interaction safety", () => {
    expect(cssSource).toContain("--saffron: #c97822");
    expect(cssSource).toContain("--space-4: 16px");
    expect(cssSource).toContain("--radius-panel: 20px");
    expect(cssSource).toContain("@media (prefers-reduced-motion: reduce)");
    expect(cssSource).toContain("min-height: 44px");
  });

  it("keeps the application shell responsive and navigable", () => {
    expect(shellSource).toContain('href="/app/usage"');
    expect(shellSource).toContain('aria-label="Primary navigation"');
    expect(cssSource).toContain(".mobile-discovery-nav");
    expect(cssSource).toContain("grid-template-columns: 1fr;");
  });
});
