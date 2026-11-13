import { describe, expect, it } from "vitest";
import {
  configuredCorsOrigins,
  CORS_ALLOWED_HEADERS,
} from "../apps/api/src/cors";

describe("API CORS configuration", () => {
  it("allows both local browser hostnames by default", () => {
    expect(configuredCorsOrigins("")).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });

  it("supports an explicit comma-separated deployment allowlist", () => {
    expect(
      configuredCorsOrigins(
        " https://creator.example,https://www.creator.example ",
      ),
    ).toEqual(["https://creator.example", "https://www.creator.example"]);
  });

  it("allows the idempotency header used by generation requests", () => {
    expect(CORS_ALLOWED_HEADERS).toContain("Idempotency-Key");
  });
});
