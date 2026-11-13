import { describe, expect, it } from "vitest";
import type { HealthResponse } from "@creator-pulse/contracts";

describe("foundation contracts", () => {
  it("models a healthy service response", () => {
    const response: HealthResponse = {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
    };

    expect(response.status).toBe("ok");
    expect(response.service).toBe("api");
  });
});
