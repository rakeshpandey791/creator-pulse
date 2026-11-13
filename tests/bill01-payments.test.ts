import { describe, expect, it } from "vitest";
import {
  CommercialService,
  CREATOR_PLAN_ID,
  InMemoryCommercialStore,
  MockManualPaymentAdapter,
} from "../apps/api/src/commercial/commercial.service.js";

describe("BILL-01 mock/manual payments", () => {
  it("activates the paid plan and grants credits exactly once", async () => {
    const store = new InMemoryCommercialStore();
    const service = new CommercialService(
      store,
      () => new Date("2026-11-13T00:00:00.000Z"),
    );
    const adapter = new MockManualPaymentAdapter();

    const first = await service.checkout(
      "creator-1",
      CREATOR_PLAN_ID,
      "checkout-1",
      adapter,
    );
    const retry = await service.checkout(
      "creator-1",
      CREATOR_PLAN_ID,
      "checkout-1",
      adapter,
    );
    const subscription = await service.subscription("creator-1");

    expect(first.status).toBe("succeeded");
    expect(retry).toEqual(first);
    expect(subscription).toMatchObject({
      status: "active",
      plan: { code: "creator" },
    });
    expect(
      store.credits.filter((entry) => entry.entryType === "grant"),
    ).toHaveLength(1);
    expect(store.auditLogs).toHaveLength(1);
  });

  it("keeps entitlement unchanged for failed and pending checkout", async () => {
    const store = new InMemoryCommercialStore();
    const service = new CommercialService(store);
    const adapter = new MockManualPaymentAdapter();

    const failed = await service.checkout(
      "creator-1",
      CREATOR_PLAN_ID,
      "checkout-failed",
      adapter,
      "failed",
    );
    const pending = await service.checkout(
      "creator-1",
      CREATOR_PLAN_ID,
      "checkout-pending",
      adapter,
      "pending",
    );

    expect(failed.status).toBe("failed");
    expect(pending.status).toBe("pending");
    expect(await service.subscription("creator-1")).toEqual({ status: "none" });
    expect(store.subscriptions).toHaveLength(0);
  });

  it("settles delayed success idempotently and supports explicit cancellation", async () => {
    const store = new InMemoryCommercialStore();
    const service = new CommercialService(store);
    const adapter = new MockManualPaymentAdapter();

    const pending = await service.checkout(
      "creator-1",
      CREATOR_PLAN_ID,
      "checkout-delayed",
      adapter,
      "pending",
    );
    const settled = await service.settlePayment(
      pending.providerTransactionId!,
      "succeeded",
    );
    const duplicate = await service.settlePayment(
      pending.providerTransactionId!,
      "succeeded",
    );
    const cancelled = await service.cancelSubscription("creator-1");

    expect(settled.status).toBe("succeeded");
    expect(duplicate).toEqual(settled);
    expect(cancelled.status).toBe("cancelled");
    expect(store.auditLogs.map((event) => event.eventType)).toEqual([
      "payment.checkout",
      "payment.webhook",
      "subscription.cancel",
    ]);
  });
});
