import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const usageSource = readFileSync(
  new URL("../apps/web/app/app/usage/page.tsx", import.meta.url),
  "utf8",
);
const billingSource = readFileSync(
  new URL("../apps/web/app/app/billing/page.tsx", import.meta.url),
  "utf8",
);
const apiSource = readFileSync(
  new URL("../apps/web/lib/api.ts", import.meta.url),
  "utf8",
);

describe("FE-05 billing UI contract", () => {
  it("uses authoritative credits and subscription APIs", () => {
    expect(usageSource).toContain("commercialApi.credits(token)");
    expect(usageSource).toContain("commercialApi.subscription(token)");
    expect(billingSource).toContain("commercialApi.checkout");
    expect(billingSource).toContain("commercialApi.cancel");
  });

  it("surfaces safe success, pending and failure recovery states", () => {
    expect(billingSource).toContain("Payment is waiting for confirmation.");
    expect(billingSource).toContain("Payment did not go through.");
    expect(billingSource).toContain(
      "No credits or subscription changes were made.",
    );
    expect(apiSource).toContain('"Idempotency-Key"');
  });

  it("keeps the Stitch responsive and accessibility contracts", () => {
    expect(usageSource).toContain('aria-label="Credit overview"');
    expect(usageSource).toContain("import { Alert, Button, Panel }");
    expect(billingSource).toContain('role="status"');
    expect(billingSource).toContain('className="mock-outcome"');
  });
});
