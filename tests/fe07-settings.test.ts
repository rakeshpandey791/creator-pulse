import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../apps/web/app/app/settings/profile/page.tsx", import.meta.url),
  "utf8",
);
const apiSource = readFileSync(
  new URL("../apps/web/lib/api.ts", import.meta.url),
  "utf8",
);
const shellSource = readFileSync(
  new URL("../apps/web/components/discovery-ui.tsx", import.meta.url),
  "utf8",
);

describe("FE-07 profile settings contracts", () => {
  it("provides editable context with native-script language choices", () => {
    expect(pageSource).toContain('active="settings"');
    expect(pageSource).toContain("languageOptions");
    expect(pageSource).toContain("nicheOptions");
    expect(pageSource).toContain("platformOptions");
    expect(pageSource).toContain("aria-pressed={isSelected}");
    expect(pageSource).toContain("Native-script examples are preserved");
    expect(pageSource).toContain("location-country");
    expect(pageSource).toContain("Coarse location only");
  });

  it("preserves unsaved edits and explains constrained combinations", () => {
    expect(pageSource).toContain("creatorpulse.profileSettingsDraft");
    expect(pageSource).toContain("We found edits from your last visit");
    expect(pageSource).toContain("Why some combinations may be quiet");
    expect(pageSource).toContain("Reset edits");
    expect(pageSource).toContain("refreshes future feed");
  });

  it("persists identity and context through authenticated APIs", () => {
    expect(apiSource).toContain('request<AuthUser>("/auth/me"');
    expect(apiSource).toContain('request<CreatorProfile>("/creator/profile"');
    expect(pageSource).toContain("authApi.updateMe(token, draft.displayName)");
    expect(pageSource).toContain("authApi.saveProfile(token");
    expect(pageSource).toContain(
      'locationConsent: draft.locationCountryCode ? "manual" : "declined"',
    );
    expect(shellSource).toContain('href="/app/settings/profile"');
  });
});
