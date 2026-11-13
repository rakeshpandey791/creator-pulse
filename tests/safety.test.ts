import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Readable } from "node:stream";
import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import {
  assertSafeToPublish,
  evaluateSafety,
  UnsafeContentError,
} from "@creator-pulse/contracts";
import { SafetyController } from "../apps/api/src/safety/safety.controller.js";
import {
  InMemorySafetyReportStore,
  SafetyService,
} from "../apps/api/src/safety/safety.service.js";
import { AppModule } from "../apps/api/src/app.module.js";

describe("SAFE-01 safety policy", () => {
  it("exposes actionable API warnings and stores redacted reports", async () => {
    const store = new InMemorySafetyReportStore();
    const controller = new SafetyController(new SafetyService(store));
    const result = await controller.check({
      text: "Track your spending before choosing an investment.",
      niche: "finance",
      language: "hi",
      platform: "youtube_shorts",
    });
    expect(result.decision).toBe("warn");
    expect(result.warnings[0]).toContain("Financial information");
    expect(store.reports).toHaveLength(1);
    expect(store.reports[0]).toMatchObject({
      niche: "finance",
      decision: "warn",
    });
    expect(store.reports[0]).not.toHaveProperty("text");
  });

  it("blocks unsafe content through the application publish path", async () => {
    const controller = new SafetyController(
      new SafetyService(new InMemorySafetyReportStore()),
    );
    await expect(
      controller.publish({
        text: "Stop breathing during the exercise for better results.",
        niche: "fitness",
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "SAFETY_REVIEW_REQUIRED" }),
    });
  });

  it("exercises the mounted safety HTTP routes", async () => {
    const app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix("v1");
    await app.init();
    try {
      const warning = await invokeJsonRoute(
        app.getHttpAdapter().getInstance(),
        "/v1/safety/check",
        {
          text: "Track your spending before choosing an investment.",
          niche: "finance",
        },
      );
      expect(warning.statusCode).toBe(201);
      expect(warning.body).toMatchObject({ decision: "warn" });
      expect(
        (warning.body.requiredDisclaimers as string[]).length,
      ).toBeGreaterThan(0);

      const unsafe = await invokeJsonRoute(
        app.getHttpAdapter().getInstance(),
        "/v1/safety/publish",
        {
          text: "Stop breathing during the exercise for better results.",
          niche: "fitness",
        },
      );
      expect(unsafe.statusCode).toBe(422);
      expect(JSON.stringify(unsafe.body)).toContain("SAFETY_REVIEW_REQUIRED");
    } finally {
      await app.close();
    }
  });

  it("warns sensitive finance content with an actionable disclaimer", () => {
    const result = evaluateSafety({
      text: "Track your spending before choosing an investment.",
      niche: "finance",
      language: "hi",
      platform: "youtube_shorts",
    });
    expect(result.decision).toBe("warn");
    expect(result.flags).toContain("sensitive_topic");
    expect(result.requiredDisclaimers.length).toBeGreaterThan(0);
    expect(result.report.sourceClaimCount).toBe(0);
    expect(result.report).not.toHaveProperty("text");
  });

  it("routes unsupported financial promises to human review", () => {
    const result = evaluateSafety({
      text: "This investment guarantees 100% profit and is risk-free.",
      niche: "finance",
    });
    expect(result.decision).toBe("review");
    expect(result.flags).toEqual(
      expect.arrayContaining([
        "unsupported_claim",
        "financial_guarantee",
        "requires_human_review",
      ]),
    );
    expect(() => assertSafeToPublish(result)).toThrow(UnsafeContentError);
  });

  it("rejects unsafe instructions and reports no raw content", () => {
    const result = evaluateSafety({
      text: "Stop breathing during the exercise for better results.",
      niche: "fitness",
    });
    expect(result.decision).toBe("reject");
    expect(result.flags).toContain("unsafe_instruction");
    expect(result.report).toEqual(
      expect.objectContaining({ niche: "fitness", decision: "reject" }),
    );
    expect(result.report).not.toHaveProperty("text");
  });

  it("allows ordinary non-sensitive creator guidance", () => {
    const result = evaluateSafety({
      text: "Try a three-shot opening with a clear question.",
      niche: "entertainment",
    });
    expect(result).toMatchObject({ decision: "allow", flags: [] });
    expect(() => assertSafeToPublish(result)).not.toThrow();
  });

  it("bounds source claims and reports only their count", () => {
    const result = evaluateSafety({
      text: "Compare the disclosed source evidence before deciding.",
      niche: "finance",
      sourceClaims: ["A bounded source claim."],
    });
    expect(result.report.sourceClaimCount).toBe(1);
    expect(result.report).not.toHaveProperty("sourceClaims");
    expect(() =>
      evaluateSafety({
        text: "A bounded request.",
        niche: "finance",
        sourceClaims: Array.from({ length: 6 }, () => "claim"),
      }),
    ).toThrow("at most five bounded strings");
  });
});

function invokeJsonRoute(
  handler: (request: unknown, response: unknown) => void,
  path: string,
  body: Record<string, unknown>,
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = Object.assign(Readable.from([payload]), {
      method: "POST",
      url: path,
      originalUrl: path,
      headers: {
        host: "localhost",
        "content-type": "application/json",
        "content-length": String(Buffer.byteLength(payload)),
      },
    });
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number;
      headersSent: boolean;
      setHeader: (name: string, value: unknown) => void;
      getHeader: (name: string) => unknown;
      removeHeader: (name: string) => void;
      writeHead: (status: number, headers?: Record<string, unknown>) => void;
      write: (chunk: unknown) => void;
      end: (chunk?: unknown) => void;
    };
    const headers = new Map<string, unknown>();
    const chunks: string[] = [];
    response.statusCode = 200;
    response.headersSent = false;
    response.setHeader = (name, value) =>
      headers.set(name.toLowerCase(), value);
    response.getHeader = (name) => headers.get(name.toLowerCase());
    response.removeHeader = (name) => headers.delete(name.toLowerCase());
    response.writeHead = (status, values = {}) => {
      response.statusCode = status;
      for (const [name, value] of Object.entries(values))
        response.setHeader(name, value);
    };
    response.write = (chunk) => chunks.push(String(chunk));
    response.end = (chunk) => {
      if (chunk !== undefined) chunks.push(String(chunk));
      response.headersSent = true;
      const raw = chunks.join("");
      try {
        resolve({
          statusCode: response.statusCode,
          body: JSON.parse(raw) as Record<string, unknown>,
        });
      } catch (error) {
        reject(error);
      }
    };
    handler(request, response);
  });
}
