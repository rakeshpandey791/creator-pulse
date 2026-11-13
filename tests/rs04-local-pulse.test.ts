import { describe, expect, it } from "vitest";
import { InMemoryCreatorProfileDependencies } from "../apps/api/src/creator/in-memory-creator-repositories.js";
import { CreatorProfileService } from "../apps/api/src/creator/creator-profile.service.js";
import {
  InMemoryLocalPulseStore,
  LocalPulseService,
  type LocalPulseSourceRecord,
  type LocalPulseSignalRecord,
} from "../apps/api/src/research/local-pulse.service.js";

const profile = {
  nicheIds: ["5f4e5c8b-3f7b-4f2a-9b31-000000000001"],
  platformIds: ["7f4e5c8b-3f7b-4f2a-9b31-000000000001"],
  languageIds: ["6f4e5c8b-3f7b-4f2a-9b31-000000000001"],
  audience: { description: "Creators who share practical fitness tips" },
};

const now = new Date("2026-11-13T12:00:00.000Z");

function source(
  id: string,
  location: LocalPulseSourceRecord["location"],
  observedAt = new Date("2026-11-13T10:00:00.000Z"),
): LocalPulseSourceRecord {
  return {
    _id: id,
    canonicalUrl: `https://example.test/${id}`,
    title: `Local signal ${id}`,
    excerpt: "A current local story with useful context.",
    retrievalStatus: "active",
    location,
    observedAt,
  };
}

function signal(id: string, sourceDocumentId: string): LocalPulseSignalRecord {
  return {
    _id: id,
    sourceDocumentId,
    topicId: "topic-1",
    signalType: "momentum",
    value: 0.8,
    confidence: 0.9,
    observedAt: new Date("2026-11-13T10:00:00.000Z"),
  };
}

async function serviceWith(
  sources: LocalPulseSourceRecord[],
  signals: LocalPulseSignalRecord[] = [],
) {
  const profiles = new CreatorProfileService(
    new InMemoryCreatorProfileDependencies(),
  );
  await profiles.replace("creator-a", {
    ...profile,
    location: {
      countryCode: "IN",
      regionCode: "BR",
      city: "Patna",
      scope: "city",
      source: "manual",
    },
    locationConsent: "manual",
  });
  return new LocalPulseService(
    profiles,
    new InMemoryLocalPulseStore(sources, signals),
  );
}

describe("RS-04 local pulse", () => {
  it("returns bounded fresh city evidence with source and signal provenance", async () => {
    const pulse = await serviceWith(
      [
        source("source-1", {
          countryCode: "IN",
          regionCode: "BR",
          city: "Patna",
        }),
        source("source-2", {
          countryCode: "IN",
          regionCode: "BR",
          city: "Patna",
        }),
      ],
      [signal("signal-1", "source-1"), signal("signal-2", "source-2")],
    );
    const result = await pulse.getForCreator("creator-a", now);
    expect(result).toMatchObject({
      scope: "city",
      locationLabel: "Patna, BR",
      fallbackUsed: false,
      coverage: "strong",
    });
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0]).toMatchObject({
      id: "source-1",
      freshness: "fresh",
    });
    expect(result.signals.map((item) => item.sourceDocumentId)).toEqual([
      "source-1",
      "source-2",
    ]);
  });

  it("falls back from city to region when city evidence is absent", async () => {
    const pulse = await serviceWith(
      [
        source("region-source", {
          countryCode: "IN",
          regionCode: "BR",
        }),
      ],
      [signal("region-signal", "region-source")],
    );
    const result = await pulse.getForCreator("creator-a", now);
    expect(result.scope).toBe("region");
    expect(result.locationLabel).toBe("BR");
    expect(result.fallbackUsed).toBe(true);
    expect(result.coverage).toBe("limited");
  });

  it("reports stale evidence honestly instead of presenting it as current", async () => {
    const pulse = await serviceWith(
      [
        source(
          "old-source",
          { countryCode: "IN", regionCode: "BR", city: "Patna" },
          new Date("2026-11-01T10:00:00.000Z"),
        ),
      ],
      [signal("old-signal", "old-source")],
    );
    const result = await pulse.getForCreator("creator-a", now);
    expect(result.coverage).toBe("limited");
    expect(result.limitation).toBe("stale_evidence");
    expect(result.sources[0]?.freshness).toBe("stale");
  });

  it("returns explicit outage and location-not-set states", async () => {
    const profiles = new CreatorProfileService(
      new InMemoryCreatorProfileDependencies(),
    );
    await profiles.replace("creator-a", {
      ...profile,
      location: null,
      locationConsent: "declined",
    });
    const noLocation = new LocalPulseService(
      profiles,
      new InMemoryLocalPulseStore(),
    );
    expect((await noLocation.getForCreator("creator-a")).limitation).toBe(
      "location_not_set",
    );

    await profiles.replace("creator-a", {
      ...profile,
      location: {
        countryCode: "IN",
        regionCode: "BR",
        city: "Patna",
        scope: "city",
        source: "manual",
      },
      locationConsent: "manual",
    });
    const outage = new LocalPulseService(
      profiles,
      new InMemoryLocalPulseStore([], [], true),
    );
    expect((await outage.getForCreator("creator-a", now)).limitation).toBe(
      "source_outage",
    );
  });
});
