import { describe, expect, it } from "vitest";
import {
  InMemoryCreditLedgerService,
  InsufficientCreditsError,
} from "../apps/api/src/commercial/credit-ledger.service.js";

describe("CR-02 credit ledger", () => {
  it("prevents concurrent reservations from overspending", async () => {
    const ledger = new InMemoryCreditLedgerService();
    ledger.balances.set("creator-1", 10);

    const attempts = await Promise.allSettled(
      ["op-1", "op-2", "op-3", "op-4"].map((operationId) =>
        ledger.reserve("creator-1", operationId, 3),
      ),
    );

    expect(
      attempts.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(3);
    expect(
      attempts.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(ledger.balances.get("creator-1")).toBe(1);
    expect(
      attempts.some(
        (result) =>
          result.status === "rejected" &&
          result.reason instanceof InsufficientCreditsError,
      ),
    ).toBe(true);
  });

  it("makes duplicate settlement and retry calls no-ops", async () => {
    const ledger = new InMemoryCreditLedgerService();
    ledger.balances.set("creator-1", 10);

    await ledger.reserve("creator-1", "op-1", 3);
    await ledger.reserve("creator-1", "op-1", 3);
    await ledger.consume("creator-1", "op-1");
    await ledger.consume("creator-1", "op-1");
    await ledger.release("creator-1", "op-1");

    expect(ledger.balances.get("creator-1")).toBe(7);
    expect(
      ledger.entries.filter((entry) => entry.operationId === "op-1"),
    ).toHaveLength(2);
    expect(ledger.entries.map((entry) => entry.referenceKey)).toEqual([
      "reserve:op-1",
      "consume:op-1",
    ]);
  });

  it("returns a failed operation's reservation exactly once", async () => {
    const ledger = new InMemoryCreditLedgerService();
    ledger.balances.set("creator-1", 10);

    await ledger.reserve("creator-1", "op-1", 3);
    await ledger.release("creator-1", "op-1");
    await ledger.release("creator-1", "op-1");

    expect(ledger.balances.get("creator-1")).toBe(10);
    expect(
      ledger.entries.filter((entry) => entry.entryType === "release"),
    ).toHaveLength(1);
    expect(
      ledger.entries.reduce((total, entry) => total + entry.amount, 0),
    ).toBe(0);
  });

  it("finds and settles reservations left by a crashed worker", async () => {
    const ledger = new InMemoryCreditLedgerService();
    ledger.balances.set("creator-1", 10);
    const reservedAt = new Date("2026-11-01T00:00:00.000Z");
    await ledger.reserve("creator-1", "op-stuck", 3, reservedAt);

    const stuck = await ledger.reconcileStuckReservations(
      new Date("2026-11-02T00:00:00.000Z"),
      new Date("2026-11-03T00:00:00.000Z"),
    );

    expect(stuck).toEqual([
      { creatorId: "creator-1", operationId: "op-stuck", reservedAt },
    ]);
    expect(ledger.balances.get("creator-1")).toBe(10);
    expect(ledger.entries.at(-1)?.entryType).toBe("release");
  });
});
