import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ACCESS_TOKEN = "qa02-access-token";
const REFRESH_TOKEN = "qa02-refresh-token";
const nicheId = "5f4e5c8b-3f7b-4f2a-9b31-000000000001";
const platformId = "7f4e5c8b-3f7b-4f2a-9b31-000000000001";
const languageId = "6f4e5c8b-3f7b-4f2a-9b31-000000000001";

function profile() {
  return {
    profileVersion: 1,
    nicheIds: [nicheId],
    platformIds: [platformId],
    languageIds: [languageId],
    audience: { description: "Busy people who want practical daily habits" },
    contentStyle: "Clear and conversational",
    creatorGoal: "Build a trusted audience",
  };
}

function feed() {
  return {
    items: [
      {
        id: "idea-qa02",
        title: "A five-minute habit your audience can try today",
        summary: "A practical, evidence-backed angle for a short video.",
        languageId,
        platformId,
        nicheId,
        score: null,
        coverage: {
          sourceCount: 1,
          signalCount: 1,
          staleSourceCount: 0,
          missingEvidence: false,
          uncertainty: "none",
        },
      },
    ],
    nextCursor: null,
    fallback: { kind: "none", message: null },
    rankingVersion: "qa02",
    profileVersion: 1,
  };
}

async function prepareApi(page: Page) {
  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/v1\//u, "");
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (path === "auth/signup" && request.method() === "POST")
      return json({
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
        user: {
          id: "creator-qa02",
          email: "qa02@example.test",
          displayName: "QA Creator",
        },
      });
    if (path === "creator/profile" && request.method() === "PUT")
      return json(profile());
    if (path === "feed/daily") return json(feed());
    if (path === "auth/me")
      return json({
        id: "creator-qa02",
        email: "qa02@example.test",
        displayName: "QA Creator",
      });
    if (path === "creator/profile" && request.method() === "GET")
      return json(profile());
    return json(
      { message: `Unhandled QA-02 route: ${request.method()} ${path}` },
      500,
    );
  });
}

test.describe("QA-02 creator journey", () => {
  test("completes signup, onboarding, and reaches the personalized feed", async ({
    page,
  }) => {
    await prepareApi(page);
    await page.goto("/signup");
    await page.getByLabel("Your first and last name").fill("QA Creator");
    await page.getByLabel("Email address").fill("qa02@example.test");
    await page.getByLabel("Password").fill("safe-password-123");
    await page.getByRole("button", { name: /Create my workspace/ }).click();

    await expect(
      page.getByRole("heading", { name: "What do you want to talk about?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Fitness" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Instagram" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Hindi" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page
      .getByLabel("My audience is…")
      .fill("Busy people who want practical daily habits");
    await page.getByLabel("My content style").fill("Clear and conversational");
    await page.getByLabel("My creator goal").fill("Build a trusted audience");
    await page.getByRole("button", { name: /Finish setup/ }).click();
    await page.getByRole("button", { name: /Explore CreatorPulse/ }).click();

    await expect(
      page.getByRole("heading", { name: "Good morning, creator." }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /five-minute habit/ }),
    ).toBeVisible();
    await expect(page.getByText("Publish directly")).toHaveCount(0);
  });

  test("keeps recovery states actionable and the login screen accessible", async ({
    page,
  }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    await page.getByLabel("Email address").fill("not-an-email");
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: /Sign in/ }).click();
    await expect(page.getByRole("alert")).toContainText("valid email");
  });
});

test.describe("QA-02 visual regression", () => {
  test.skip(
    !process.env.RUN_VISUAL_REGRESSION,
    "Visual baselines are reviewed and updated only in the release QA environment.",
  );

  test("captures the Stitch authentication reference at desktop and mobile breakpoints", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page).toHaveScreenshot("auth-login-desktop.png", {
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page).toHaveScreenshot("auth-login-mobile.png", {
      animations: "disabled",
    });
  });
});
