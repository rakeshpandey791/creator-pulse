import { expect, test, type Page, type Route } from "@playwright/test";

const ACCESS_TOKEN = "browser-test-access-token";

function idea(id: string, title: string) {
  return {
    id,
    title,
    summary: "A practical idea with evidence a creator can use.",
    languageId: "6f4e5c8b-3f7b-4f2a-9b31-000000000001",
    platformId: "7f4e5c8b-3f7b-4f2a-9b31-000000000001",
    nicheId: "5f4e5c8b-3f7b-4f2a-9b31-000000000001",
    score: null,
    coverage: {
      sourceCount: 1,
      signalCount: 1,
      staleSourceCount: 0,
      missingEvidence: false,
      uncertainty: "none",
    },
    evidence: [],
    origin: "recommendation",
    topicId: "topic-1",
  };
}

function libraryItem(id: string, title: string, status = "saved") {
  const timestamp = "2026-11-13T00:00:00.000Z";
  return {
    saved: {
      _id: `save-${id}`,
      creatorId: "creator-browser",
      ideaId: id,
      savedAt: timestamp,
      currentStatus: status,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    status: {
      _id: `status-${id}`,
      creatorId: "creator-browser",
      ideaId: id,
      status,
      occurredAt: timestamp,
      source: "user",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    idea: idea(id, title),
    assets: [],
  };
}

async function fulfillLibrary(
  route: Route,
  items: unknown[],
  nextCursor: string | null = null,
) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ items, nextCursor }),
  });
}

async function prepare(page: Page) {
  await page.addInitScript((token) => {
    window.localStorage.setItem("creatorpulse.accessToken", token);
  }, ACCESS_TOKEN);
}

test.describe("Library browser flow", () => {
  test("renders cards, filters, mutates status, and loads the next page", async ({
    page,
  }) => {
    await prepare(page);
    await page.route("**/v1/library**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("cursor")) {
        await fulfillLibrary(route, [
          libraryItem("idea-3", "A second useful angle"),
        ]);
      } else if (url.searchParams.get("status") === "planned") {
        await fulfillLibrary(route, [
          libraryItem("idea-2", "A planned angle", "planned"),
        ]);
      } else {
        await fulfillLibrary(
          route,
          [libraryItem("idea-1", "Morning mobility in five minutes")],
          "next-page",
        );
      }
    });
    await page.route("**/v1/ideas/idea-1/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          libraryItem("idea-1", "Morning mobility in five minutes", "planned")
            .status,
        ),
      });
    });

    await page.goto("/app/library");
    await expect(
      page.getByRole("heading", { name: "Your idea shelf." }),
    ).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(
      page.getByRole("link", { name: "Morning mobility in five minutes" }),
    ).toBeVisible();
    await expect(page.getByLabel("Library filters")).toBeVisible();

    await page.getByRole("combobox").selectOption("planned");
    await expect(page.getByRole("article")).toContainText("Planned");

    await page.getByRole("button", { name: "Load more saved ideas" }).click();
    await expect(page.getByRole("article")).toHaveCount(2);
  });

  test("exposes an actionable error state and a one-column mobile layout", async ({
    page,
  }) => {
    await prepare(page);
    await page.route("**/v1/library**", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Library service is temporarily unavailable.",
        }),
      });
    });

    await page.goto("/app/library");
    await expect(page.getByRole("alert")).toHaveText(
      "Library service is temporarily unavailable.",
    );
    await expect(
      page.getByRole("button", { name: "All saved" }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".mobile-nav")).toBeVisible();
    const columns = await page
      .locator(".library-grid")
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/)
            .length,
      );
    expect(columns).toBe(1);
  });
});
