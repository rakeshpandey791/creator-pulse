import { LANGUAGE_CATALOG } from "@creator-pulse/contracts";

export const nicheOptions = [
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000001", "Fitness"],
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000002", "Food"],
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000003", "Finance"],
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000004", "Education"],
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000005", "Entertainment"],
  ["5f4e5c8b-3f7b-4f2a-9b31-000000000006", "Lifestyle"],
] as const;

export const platformOptions = [
  ["7f4e5c8b-3f7b-4f2a-9b31-000000000001", "Instagram"],
  ["7f4e5c8b-3f7b-4f2a-9b31-000000000002", "YouTube"],
  ["7f4e5c8b-3f7b-4f2a-9b31-000000000003", "Facebook"],
] as const;

export const languageOptions = LANGUAGE_CATALOG.map(
  ({ id, name, nativeName }) => [id, name, nativeName] as const,
);

export const countryOptions = [["IN", "India"]] as const;
export const regionOptions = [
  ["BR", "Bihar"],
  ["UP", "Uttar Pradesh"],
  ["JH", "Jharkhand"],
  ["DL", "Delhi"],
  ["MH", "Maharashtra"],
] as const;
export const cityOptions = [
  ["patna", "Patna"],
  ["gaya", "Gaya"],
  ["muzaffarpur", "Muzaffarpur"],
  ["bhagalpur", "Bhagalpur"],
  ["ranchi", "Ranchi"],
  ["delhi", "Delhi"],
] as const;

export type ProfileDraft = {
  displayName: string;
  nicheIds: string[];
  platformIds: string[];
  languageIds: string[];
  audience: string;
  contentStyle: string;
  creatorGoal: string;
  experienceLevel: string;
  locationCountryCode: string;
  locationRegionCode: string;
  locationCity: string;
};
