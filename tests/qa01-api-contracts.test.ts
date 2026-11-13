import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { CommercialController } from "../apps/api/src/commercial/commercial.controller";
import { CreatorProfileController } from "../apps/api/src/creator/creator-profile.controller";
import { DiscoveryController } from "../apps/api/src/discovery/discovery.controller";
import { FeedbackController } from "../apps/api/src/feedback/feedback.controller";
import { GenerationController } from "../apps/api/src/generation/generation.controller";
import { IdentityController } from "../apps/api/src/identity/identity.controller";
import { LanguageController } from "../apps/api/src/language/language.controller";
import { ObservabilityController } from "../apps/api/src/observability/observability.controller";
import { SafetyController } from "../apps/api/src/safety/safety.controller";
import { LocalPulseController } from "../apps/api/src/research/local-pulse.controller";

const controllers = [
  CommercialController,
  CreatorProfileController,
  DiscoveryController,
  FeedbackController,
  GenerationController,
  IdentityController,
  LanguageController,
  ObservabilityController,
  SafetyController,
  LocalPulseController,
];

function routeContracts() {
  return controllers.flatMap((controller) => {
    const prefix = String(Reflect.getMetadata(PATH_METADATA, controller) ?? "");
    return Object.getOwnPropertyNames(controller.prototype)
      .filter((name) => name !== "constructor")
      .flatMap((name) => {
        const method = Reflect.getMetadata(
          METHOD_METADATA,
          controller.prototype[name],
        ) as RequestMethod | undefined;
        if (method === undefined) return [];
        const path = String(
          Reflect.getMetadata(PATH_METADATA, controller.prototype[name]) ?? "",
        );
        const fullPath = [prefix, path]
          .map((segment) => segment.replace(/^\/+|\/+$/gu, ""))
          .filter(Boolean)
          .join("/")
          .replaceAll(/\/+/gu, "/");
        return [`${RequestMethod[method]} /v1/${fullPath}`];
      });
  });
}

describe("QA-01 API route contracts", () => {
  it("keeps every public API route registered", () => {
    const routes = routeContracts();
    expect(routes).toEqual(
      expect.arrayContaining([
        "POST /v1/auth/signup",
        "POST /v1/auth/login",
        "POST /v1/auth/refresh",
        "GET /v1/auth/me",
        "GET /v1/creator/profile",
        "PUT /v1/creator/profile",
        "GET /v1/local-pulse",
        "GET /v1/feed/daily",
        "GET /v1/ideas/search",
        "GET /v1/library",
        "POST /v1/ideas/:ideaId/generations",
        "GET /v1/operations/:operationId",
        "GET /v1/plans",
        "GET /v1/credits",
        "POST /v1/ideas/:ideaId/feedback",
        "POST /v1/safety/check",
        "POST /v1/safety/publish",
        "GET /v1/languages",
        "GET /v1/health/metrics",
      ]),
    );
  });

  it("does not register duplicate method/path contracts", () => {
    const routes = routeContracts();
    expect(new Set(routes).size).toBe(routes.length);
  });
});
