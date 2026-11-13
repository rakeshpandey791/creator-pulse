import { BadRequestException, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { isSupportedLanguageIdentifier } from "@creator-pulse/contracts";
import type {
  CreatorProfile,
  CreatorProfileRepository,
  TaxonomyRepository,
  TaxonomyRecord,
} from "../infrastructure/persistence/repository-ports.js";

export type ProfileInput = {
  nicheIds: string[];
  platformIds: string[];
  languageIds: string[];
  audience: {
    description: string;
    ageBands?: string[];
    geography?: string[];
    interests?: string[];
  };
  contentStyle?: string;
  creatorGoal?: string;
  experienceLevel?: string;
  location?: {
    countryCode: string;
    regionCode?: string;
    city?: string;
    scope: "country" | "region" | "city";
    source: "manual" | "approximate";
  } | null;
  locationConsent?: "manual" | "approximate" | "declined";
};

export type ProfilePatch = Partial<ProfileInput>;

export interface CreatorProfileDependencies {
  profiles: CreatorProfileRepository;
  niches: TaxonomyRepository<TaxonomyRecord>;
  languages: TaxonomyRepository<TaxonomyRecord>;
  platforms: TaxonomyRepository<TaxonomyRecord>;
}

export class CreatorProfileService {
  constructor(private readonly dependencies: CreatorProfileDependencies) {}

  async get(creatorId: string): Promise<Readonly<CreatorProfile> | null> {
    const page = await this.dependencies.profiles.list({ creatorId }, {}, 1);
    return page.items[0] ?? null;
  }

  async replace(
    creatorId: string,
    input: ProfileInput,
  ): Promise<Readonly<CreatorProfile>> {
    const normalized = await this.validate(input);
    const current = await this.get(creatorId);
    const now = new Date();
    if (!current) {
      return this.dependencies.profiles.insert(
        { creatorId },
        {
          _id: randomUUID(),
          userId: creatorId,
          ...normalized,
          profileVersion: 1,
          createdAt: now,
          updatedAt: now,
        },
      );
    }
    const changed = rankingFieldsChanged(current, normalized);
    if (!changed) return current;
    const updated = await this.dependencies.profiles.updateIfVersion(
      { creatorId },
      current._id,
      current.profileVersion,
      {
        $set: {
          ...normalized,
          profileVersion: current.profileVersion + 1,
          updatedAt: now,
        },
      },
    );
    if (!updated) {
      throw new BadRequestException(
        "Profile changed concurrently; retry the update",
      );
    }
    return updated;
  }

  async patch(
    creatorId: string,
    patch: ProfilePatch,
  ): Promise<Readonly<CreatorProfile>> {
    const current = await this.get(creatorId);
    if (!current) throw new NotFoundException("Creator profile not found");
    const merged: ProfileInput = {
      nicheIds: current.nicheIds,
      platformIds: current.platformIds,
      languageIds: current.languageIds,
      audience: current.audience,
      contentStyle: current.contentStyle,
      creatorGoal: current.creatorGoal,
      experienceLevel: current.experienceLevel,
      location: current.location,
      locationConsent: current.locationConsent,
      ...patch,
    };
    return this.replace(creatorId, merged);
  }

  private async validate(input: ProfileInput): Promise<ProfileInput> {
    const arrays = [input.nicheIds, input.platformIds, input.languageIds];
    if (
      arrays.some(
        (values) =>
          !Array.isArray(values) || values.length === 0 || values.length > 10,
      )
    ) {
      throw new BadRequestException(
        "Niches, platforms, and languages must be non-empty bounded lists",
      );
    }
    if (
      arrays.some(
        (values) =>
          new Set(values).size !== values.length ||
          values.some((value) => typeof value !== "string"),
      )
    ) {
      throw new BadRequestException(
        "Taxonomy selections must contain unique IDs",
      );
    }
    const [niches, languages, platforms] = await Promise.all([
      this.dependencies.niches.listActive(),
      this.dependencies.languages.listActive(),
      this.dependencies.platforms.listActive(),
    ]);
    if (input.languageIds.some((id) => !isSupportedLanguageIdentifier(id)))
      throw new BadRequestException("One or more language IDs are unsupported");
    assertActive(input.nicheIds, niches, "niche");
    assertActive(input.languageIds, languages, "language");
    assertActive(input.platformIds, platforms, "platform");
    validateAudience(input.audience);
    validateLocation(input.location, input.locationConsent);
    for (const [name, value, max] of [
      ["contentStyle", input.contentStyle, 300],
      ["creatorGoal", input.creatorGoal, 300],
      ["experienceLevel", input.experienceLevel, 80],
    ] as const) {
      if (
        value !== undefined &&
        (typeof value !== "string" || value.length > max)
      )
        throw new BadRequestException(`${name} is too long`);
    }
    return input;
  }
}

function assertActive(
  ids: string[],
  records: Readonly<TaxonomyRecord>[],
  label: string,
) {
  const active = new Set(records.map((record) => record._id));
  if (ids.some((id) => !active.has(id)))
    throw new BadRequestException(
      `One or more ${label} IDs are inactive or invalid`,
    );
}

function validateAudience(audience: ProfileInput["audience"]) {
  const allowed = new Set([
    "description",
    "ageBands",
    "geography",
    "interests",
  ]);
  if (
    !audience ||
    typeof audience.description !== "string" ||
    audience.description.trim().length === 0 ||
    audience.description.length > 500
  ) {
    throw new BadRequestException(
      "Audience description is required and bounded",
    );
  }
  if (Object.keys(audience).some((key) => !allowed.has(key)))
    throw new BadRequestException("Audience contains unsupported fields");
  for (const values of [
    audience.ageBands,
    audience.geography,
    audience.interests,
  ]) {
    if (
      values !== undefined &&
      (!Array.isArray(values) ||
        values.length > 10 ||
        values.some((value) => typeof value !== "string" || value.length > 80))
    )
      throw new BadRequestException("Audience lists are too long");
  }
}

function validateLocation(
  location: ProfileInput["location"],
  consent: ProfileInput["locationConsent"],
) {
  if (
    consent !== undefined &&
    !["manual", "approximate", "declined"].includes(consent)
  ) {
    throw new BadRequestException("Location consent is invalid");
  }
  if (consent === "declined") {
    if (location !== null && location !== undefined) {
      throw new BadRequestException(
        "Declined location consent cannot include location data",
      );
    }
    return;
  }
  if (location === undefined || location === null) return;
  const allowed = new Set([
    "countryCode",
    "regionCode",
    "city",
    "scope",
    "source",
  ]);
  if (Object.keys(location).some((key) => !allowed.has(key))) {
    throw new BadRequestException("Location contains unsupported fields");
  }
  if (
    typeof location.countryCode !== "string" ||
    !/^[A-Z]{2}$/u.test(location.countryCode)
  ) {
    throw new BadRequestException(
      "Location country must be a two-letter uppercase code",
    );
  }
  if (!["country", "region", "city"].includes(location.scope)) {
    throw new BadRequestException("Location scope is invalid");
  }
  if (!["manual", "approximate"].includes(location.source)) {
    throw new BadRequestException("Location source is invalid");
  }
  if (consent !== undefined && consent !== location.source) {
    throw new BadRequestException("Location consent does not match its source");
  }
  if (
    location.regionCode !== undefined &&
    (typeof location.regionCode !== "string" ||
      !/^[A-Za-z0-9-]{1,16}$/u.test(location.regionCode))
  ) {
    throw new BadRequestException("Location region is invalid");
  }
  if (
    location.city !== undefined &&
    (typeof location.city !== "string" ||
      location.city.trim().length === 0 ||
      location.city.length > 80)
  ) {
    throw new BadRequestException("Location city is invalid");
  }
  if (location.scope === "region" && !location.regionCode) {
    throw new BadRequestException("Region location requires a region code");
  }
  if (location.scope === "city" && (!location.regionCode || !location.city)) {
    throw new BadRequestException("City location requires a region and city");
  }
  if (location.scope === "country" && (location.regionCode || location.city)) {
    throw new BadRequestException(
      "Country location cannot include region or city",
    );
  }
}

function rankingFieldsChanged(current: CreatorProfile, next: ProfileInput) {
  return (
    JSON.stringify({
      nicheIds: current.nicheIds,
      platformIds: current.platformIds,
      languageIds: current.languageIds,
      audience: current.audience,
      contentStyle: current.contentStyle,
      creatorGoal: current.creatorGoal,
      experienceLevel: current.experienceLevel,
      location: current.location,
      locationConsent: current.locationConsent,
    }) !== JSON.stringify(next)
  );
}
