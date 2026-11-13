import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { reconcileLibraryStatus } from "../apps/web/lib/library-state";
import type { IdeaStatusEvent, LibraryItem } from "../apps/web/lib/api";

const pageSource = readFileSync(
  new URL("../apps/web/app/app/library/page.tsx", import.meta.url),
  "utf8",
);
const cssSource = readFileSync(
  new URL("../apps/web/app/globals.css", import.meta.url),
  "utf8",
);

function item(id: string, status: "saved" | "planned" = "saved") {
  return {
    saved: {
      _id: `save-${id}`,
      creatorId: "creator-a",
      ideaId: id,
      savedAt: "2026-11-13T00:00:00.000Z",
      currentStatus: status,
      createdAt: "2026-11-13T00:00:00.000Z",
      updatedAt: "2026-11-13T00:00:00.000Z",
    },
    status: { status } as IdeaStatusEvent,
    idea: { id } as LibraryItem["idea"],
    assets: [],
  } as LibraryItem;
}

describe("FE-04 Library UI contract", () => {
  it("removes a card when a status mutation leaves the active filter", () => {
    const event = { status: "planned" } as IdeaStatusEvent;
    const result = reconcileLibraryStatus(
      [item("idea-1"), item("idea-2")],
      "idea-1",
      "planned",
      event,
      "saved",
    );
    expect(result.map((entry) => entry.idea.id)).toEqual(["idea-2"]);
  });

  it("updates the card in place when it still matches the active filter", () => {
    const event = { status: "planned" } as IdeaStatusEvent;
    const result = reconcileLibraryStatus(
      [item("idea-1")],
      "idea-1",
      "planned",
      event,
      "planned",
    );
    expect(result[0]?.saved.currentStatus).toBe("planned");
    expect(result[0]?.status).toBe(event);
  });

  it("keeps Stitch-aligned accessibility and responsive contracts in the screen", () => {
    expect(pageSource).toContain('aria-label="Library filters"');
    expect(pageSource).toContain('aria-label="Loading library"');
    expect(pageSource).toContain('role="alert"');
    expect(pageSource).toContain(
      "aria-pressed={statusFilter === option.value}",
    );
    expect(cssSource).toContain(".library-grid");
    expect(cssSource).toContain("grid-template-columns: 1fr;");
    expect(cssSource).toContain("--saffron: #c97822");
  });
});
