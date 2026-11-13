import { describe, expect, it } from "vitest";
import { InMemoryCreatorProfileDependencies } from "../apps/api/src/creator/in-memory-creator-repositories.js";
import { CreatorProfileService } from "../apps/api/src/creator/creator-profile.service.js";

const valid = {
  nicheIds: ["5f4e5c8b-3f7b-4f2a-9b31-000000000001"],
  platformIds: [
    "7f4e5c8b-3f7b-4f2a-9b31-000000000001",
    "7f4e5c8b-3f7b-4f2a-9b31-000000000002",
  ],
  languageIds: ["6f4e5c8b-3f7b-4f2a-9b31-000000000001"],
  audience: {
    description: "Young fitness creators in India",
    geography: ["India"],
  },
  contentStyle: "Practical and encouraging",
  creatorGoal: "Grow a consistent short-form channel",
};

describe("creator profile", () => {
  it("accepts the UUID taxonomy IDs used by the web onboarding flow", async () => {
    const service = new CreatorProfileService(
      new InMemoryCreatorProfileDependencies(),
    );
    const profile = await service.replace("creator-a", {
      ...valid,
      nicheIds: [
        "5f4e5c8b-3f7b-4f2a-9b31-000000000001",
        "5f4e5c8b-3f7b-4f2a-9b31-000000000002",
        "5f4e5c8b-3f7b-4f2a-9b31-000000000003",
        "5f4e5c8b-3f7b-4f2a-9b31-000000000004",
        "5f4e5c8b-3f7b-4f2a-9b31-000000000005",
        "5f4e5c8b-3f7b-4f2a-9b31-000000000006",
      ],
      platformIds: [
        "7f4e5c8b-3f7b-4f2a-9b31-000000000001",
        "7f4e5c8b-3f7b-4f2a-9b31-000000000002",
        "7f4e5c8b-3f7b-4f2a-9b31-000000000003",
      ],
      languageIds: [
        "6f4e5c8b-3f7b-4f2a-9b31-000000000001",
        "6f4e5c8b-3f7b-4f2a-9b31-000000000002",
        "6f4e5c8b-3f7b-4f2a-9b31-000000000003",
      ],
    });
    expect(profile.nicheIds).toHaveLength(6);
    expect(profile.platformIds).toHaveLength(3);
    expect(profile.languageIds).toHaveLength(3);
  });

  it("validates taxonomy, persists multiple selections, and versions changes", async () => {
    const service = new CreatorProfileService(
      new InMemoryCreatorProfileDependencies(),
    );
    const first = await service.replace("creator-a", valid);
    expect(first.profileVersion).toBe(1);
    expect(first.platformIds).toEqual([
      "7f4e5c8b-3f7b-4f2a-9b31-000000000001",
      "7f4e5c8b-3f7b-4f2a-9b31-000000000002",
    ]);
    const changed = await service.patch("creator-a", {
      audience: { description: "Experienced home fitness creators" },
    });
    expect(changed.profileVersion).toBe(2);
    expect((await service.get("creator-a"))?.profileVersion).toBe(2);
    expect(await service.get("creator-b")).toBeNull();
  });

  it("rejects invalid taxonomy and unrestricted audience fields", async () => {
    const service = new CreatorProfileService(
      new InMemoryCreatorProfileDependencies(),
    );
    await expect(
      service.replace("creator-a", { ...valid, nicheIds: ["missing"] }),
    ).rejects.toThrow("inactive or invalid");
    await expect(
      service.replace("creator-a", {
        ...valid,
        audience: {
          ...valid.audience,
          sensitiveNotes: "do not store",
        } as never,
      }),
    ).rejects.toThrow("unsupported fields");
  });

  it("does not reuse a profile version during concurrent edits", async () => {
    const service = new CreatorProfileService(
      new InMemoryCreatorProfileDependencies(),
    );
    await service.replace("creator-a", valid);
    const results = await Promise.allSettled([
      service.patch("creator-a", { creatorGoal: "Goal one" }),
      service.patch("creator-a", { creatorGoal: "Goal two" }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect((await service.get("creator-a"))?.profileVersion).toBe(2);
  });

  it("stores only explicit coarse location context and versions location changes", async () => {
    const service = new CreatorProfileService(
      new InMemoryCreatorProfileDependencies(),
    );
    const first = await service.replace("creator-a", {
      ...valid,
      location: {
        countryCode: "IN",
        regionCode: "BR",
        city: "Patna",
        scope: "city",
        source: "manual",
      },
      locationConsent: "manual",
    });
    expect(first.location).toEqual({
      countryCode: "IN",
      regionCode: "BR",
      city: "Patna",
      scope: "city",
      source: "manual",
    });
    expect(first.profileVersion).toBe(1);

    const countryOnly = await service.patch("creator-a", {
      location: {
        countryCode: "IN",
        scope: "country",
        source: "manual",
      },
      locationConsent: "manual",
    });
    expect(countryOnly.location?.scope).toBe("country");
    expect(countryOnly.profileVersion).toBe(2);

    const declined = await service.patch("creator-a", {
      location: null,
      locationConsent: "declined",
    });
    expect(declined.location).toBeNull();
    expect(declined.locationConsent).toBe("declined");
    expect(declined.profileVersion).toBe(3);
  });

  it("rejects exact-coordinate, malformed and mismatched location input", async () => {
    const service = new CreatorProfileService(
      new InMemoryCreatorProfileDependencies(),
    );
    await expect(
      service.replace("creator-a", {
        ...valid,
        location: {
          countryCode: "IN",
          scope: "country",
          source: "approximate",
          coordinates: { latitude: 25.6, longitude: 85.1 },
        } as never,
        locationConsent: "approximate",
      }),
    ).rejects.toThrow("unsupported fields");
    await expect(
      service.replace("creator-a", {
        ...valid,
        location: {
          countryCode: "India",
          scope: "country",
          source: "manual",
        },
        locationConsent: "manual",
      }),
    ).rejects.toThrow("two-letter uppercase code");
    await expect(
      service.replace("creator-a", {
        ...valid,
        location: {
          countryCode: "IN",
          scope: "country",
          source: "manual",
        },
        locationConsent: "declined",
      }),
    ).rejects.toThrow("cannot include location data");
  });

  it("allows a country-only profile when location is declined or unavailable", async () => {
    const service = new CreatorProfileService(
      new InMemoryCreatorProfileDependencies(),
    );
    const profile = await service.replace("creator-a", {
      ...valid,
      location: null,
      locationConsent: "declined",
    });
    expect(profile.location).toBeNull();
    expect(profile.locationConsent).toBe("declined");
  });
});
