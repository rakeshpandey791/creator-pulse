import { describe, expect, it } from "vitest";
import {
  CommercialService,
  InMemoryCommercialStore,
} from "../apps/api/src/commercial/commercial.service.js";

describe("CR-01 commercial policy", () => {
  it("returns versioned free and paid plans with configured generation costs", async () => {
    const service = new CommercialService(new InMemoryCommercialStore());
    const plans = await service.listPlans();

    expect(plans.map((plan) => plan.code)).toEqual(["free", "creator"]);
    expect(plans[0]).toMatchObject({
      monthlyCredits: 12,
      priceMinor: 0,
      operationCosts: { generation: 3 },
      version: 1,
    });
  });

  it("creates one monthly entitlement and idempotent grant per creator", async () => {
    const store = new InMemoryCommercialStore();
    const service = new CommercialService(
      store,
      () => new Date("2026-11-13T12:00:00.000Z"),
    );

    await service.ensureEntitlement("creator-1");
    await service.ensureEntitlement("creator-1");
    const credits = await service.getCredits("creator-1");

    expect([...store.subscriptions.values()]).toHaveLength(1);
    expect(store.credits).toHaveLength(1);
    expect(credits.balance).toBe(12);
    expect(new Date(credits.renewalAt).toISOString()).toBe(
      "2026-12-01T00:00:00.000Z",
    );
  });

  it("starts a fresh entitlement at the next period without rewriting history", async () => {
    const store = new InMemoryCommercialStore();
    const service = new CommercialService(
      store,
      () => new Date("2026-11-13T12:00:00.000Z"),
    );
    await service.ensureEntitlement("creator-1");
    const first = [...store.subscriptions.values()][0];
    first.periodEnd = new Date("2026-11-01T00:00:00.000Z");

    await service.ensureEntitlement(
      "creator-1",
      new Date("2026-12-02T12:00:00.000Z"),
    );

    expect([...store.subscriptions.values()]).toHaveLength(2);
    expect([...store.subscriptions.values()][0]?.planId).toBe(first.planId);
    expect(store.credits).toHaveLength(2);
  });

  it("does not double-grant a seeded welcome credit", async () => {
    const store = new InMemoryCommercialStore();
    store.credits.push({
      _id: "welcome-grant",
      creatorId: "creator-1",
      entryType: "grant",
      amount: 12,
      balanceAfter: 12,
      referenceKey: "welcome-v1",
      occurredAt: new Date("2026-11-11T00:00:00.000Z"),
      createdAt: new Date("2026-11-11T00:00:00.000Z"),
      updatedAt: new Date("2026-11-11T00:00:00.000Z"),
    });
    const service = new CommercialService(
      store,
      () => new Date("2026-11-13T12:00:00.000Z"),
    );

    await service.ensureEntitlement("creator-1");

    expect(store.credits).toHaveLength(1);
  });
});
