import { describe, expect, it } from "vitest";
import {
  MetricsRegistry,
  StructuredLogger,
  redactTelemetry,
} from "@creator-pulse/contracts";

describe("OBS-01 telemetry", () => {
  it("redacts secrets, prompts, content and email-shaped fields", () => {
    const result = redactTelemetry({
      authorization: "Bearer secret",
      prompt: "private creator prompt",
      content: "generated script",
      email: "creator@example.com",
      requestId: "req-1",
    }) as Record<string, unknown>;
    expect(result.authorization).toBe("[REDACTED]");
    expect(result.prompt).toBe("[REDACTED]");
    expect(result.content).toBe("[REDACTED]");
    expect(result.email).toBe("[REDACTED]");
    expect(result.requestId).toBe("req-1");
  });

  it("writes structured JSON without leaking protected fields", () => {
    const lines: string[] = [];
    const logger = new StructuredLogger("test", (line) => lines.push(line));
    logger.info("generation.completed", {
      requestId: "req-1",
      operationId: "op-1",
      prompt: "do not log this",
    });
    const entry = JSON.parse(lines[0] ?? "{}");
    expect(entry.event).toBe("generation.completed");
    expect(entry.requestId).toBe("req-1");
    expect(entry.prompt).toBe("[REDACTED]");
    expect(lines.join("\n")).not.toContain("do not log this");
  });

  it("emits bounded counters and observations for dashboard scraping", () => {
    const metrics = new MetricsRegistry();
    metrics.increment("provider_requests_total", {
      provider: "fake",
      outcome: "success",
    });
    metrics.observe("provider_duration_ms", 42, { provider: "fake" });
    const snapshot = metrics.snapshot();
    expect(snapshot.counters).toHaveLength(1);
    expect(snapshot.counters[0]?.value).toBe(1);
    expect(snapshot.observations[0]?.value).toBe(42);
    expect(metrics.toPrometheus()).toContain("provider_requests_total");
  });
});
