import { randomUUID } from "node:crypto";
import type { Collection, Db } from "mongodb";

export class InsufficientCreditsError extends Error {
  readonly code = "CREDITS_INSUFFICIENT";

  constructor(
    public readonly required: number,
    public readonly available: number,
  ) {
    super("Not enough credits for this operation.");
    this.name = "InsufficientCreditsError";
  }
}

export type CreditEntryType =
  | "grant"
  | "reserve"
  | "consume"
  | "release"
  | "refund"
  | "adjustment"
  | "expiry";

export type CreditLedgerEntry = {
  _id: string;
  creatorId: string;
  operationId?: string;
  entryType: CreditEntryType;
  amount: number;
  balanceAfter: number;
  referenceKey: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type StuckReservation = {
  creatorId: string;
  operationId: string;
  reservedAt: Date;
};

export interface CreditLedgerService {
  reserve(
    creatorId: string,
    operationId: string,
    amount: number,
    now?: Date,
  ): Promise<{ balanceAfter: number }>;
  consume(creatorId: string, operationId: string, now?: Date): Promise<void>;
  release(creatorId: string, operationId: string, now?: Date): Promise<void>;
  refund(
    creatorId: string,
    operationId: string,
    amount: number,
    now?: Date,
  ): Promise<void>;
  reconcileStuckReservations(
    olderThan: Date,
    now?: Date,
  ): Promise<StuckReservation[]>;
}

type BalanceDocument = {
  _id: string;
  creatorId: string;
  balance: number;
  updatedAt: Date;
};

/**
 * Single-writer in-memory implementation used by local development and tests.
 * The promise chain makes the read/modify/write section atomic even when many
 * callers invoke reserve at the same time.
 */
export class InMemoryCreditLedgerService implements CreditLedgerService {
  readonly entries: CreditLedgerEntry[] = [];
  readonly balances = new Map<string, number>();
  private readonly locks = new Map<string, Promise<void>>();

  async reserve(
    creatorId: string,
    operationId: string,
    amount: number,
    now = new Date(),
  ) {
    return this.withCreatorLock(creatorId, async () => {
      const existing = this.entry(creatorId, `reserve:${operationId}`);
      if (existing) return { balanceAfter: existing.balanceAfter };
      const available = this.balances.has(creatorId)
        ? this.balances.get(creatorId)!
        : 10;
      if (available < amount)
        throw new InsufficientCreditsError(amount, available);
      const balanceAfter = available - amount;
      this.balances.set(creatorId, balanceAfter);
      this.append(
        creatorId,
        operationId,
        "reserve",
        -amount,
        balanceAfter,
        now,
      );
      return { balanceAfter };
    });
  }

  async consume(creatorId: string, operationId: string, now = new Date()) {
    return this.withCreatorLock(creatorId, async () => {
      if (this.entry(creatorId, `consume:${operationId}`)) return;
      const reservation = this.entry(creatorId, `reserve:${operationId}`);
      if (!reservation || this.entry(creatorId, `release:${operationId}`))
        throw new Error("Credit reservation is not available");
      this.append(
        creatorId,
        operationId,
        "consume",
        0,
        reservation.balanceAfter,
        now,
      );
    });
  }

  async release(creatorId: string, operationId: string, now = new Date()) {
    return this.withCreatorLock(creatorId, async () => {
      if (
        this.entry(creatorId, `release:${operationId}`) ||
        this.entry(creatorId, `consume:${operationId}`)
      )
        return;
      const reservation = this.entry(creatorId, `reserve:${operationId}`);
      if (!reservation) return;
      const balanceAfter =
        (this.balances.get(creatorId) ?? 0) + Math.abs(reservation.amount);
      this.balances.set(creatorId, balanceAfter);
      this.append(
        creatorId,
        operationId,
        "release",
        Math.abs(reservation.amount),
        balanceAfter,
        now,
      );
    });
  }

  async refund(
    creatorId: string,
    operationId: string,
    amount: number,
    now = new Date(),
  ) {
    return this.withCreatorLock(creatorId, async () => {
      if (this.entry(creatorId, `refund:${operationId}`)) return;
      const balanceAfter = (this.balances.get(creatorId) ?? 0) + amount;
      this.balances.set(creatorId, balanceAfter);
      this.append(creatorId, operationId, "refund", amount, balanceAfter, now);
    });
  }

  async reconcileStuckReservations(olderThan: Date, now = new Date()) {
    const stuck = this.entries
      .filter(
        (entry) =>
          entry.entryType === "reserve" && entry.occurredAt < olderThan,
      )
      .filter(
        (entry) =>
          !this.entry(entry.creatorId, `consume:${entry.operationId}`) &&
          !this.entry(entry.creatorId, `release:${entry.operationId}`),
      )
      .map((entry) => ({
        creatorId: entry.creatorId,
        operationId: entry.operationId!,
        reservedAt: entry.occurredAt,
      }));
    for (const item of stuck)
      await this.release(item.creatorId, item.operationId, now);
    return stuck;
  }

  private entry(creatorId: string, referenceKey: string) {
    return this.entries.find(
      (entry) =>
        entry.creatorId === creatorId && entry.referenceKey === referenceKey,
    );
  }

  private append(
    creatorId: string,
    operationId: string,
    entryType: CreditEntryType,
    amount: number,
    balanceAfter: number,
    now: Date,
  ) {
    this.entries.push({
      _id: randomUUID(),
      creatorId,
      operationId,
      entryType,
      amount,
      balanceAfter,
      referenceKey: `${entryType}:${operationId}`,
      occurredAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  private async withCreatorLock<T>(
    creatorId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const previous = this.locks.get(creatorId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    this.locks.set(creatorId, queued);
    await previous;
    try {
      return await work();
    } finally {
      release();
      if (this.locks.get(creatorId) === queued) this.locks.delete(creatorId);
    }
  }
}

/** Mongo implementation uses an atomic conditional balance update. Ledger rows remain immutable audit records. */
export class MongoCreditLedgerService implements CreditLedgerService {
  private readonly credits: Collection<CreditLedgerEntry>;
  private readonly balances: Collection<BalanceDocument>;

  constructor(private readonly db: Db) {
    this.credits = db.collection<CreditLedgerEntry>("credit_ledger");
    this.balances = db.collection<BalanceDocument>("credit_balances");
  }

  async reserve(
    creatorId: string,
    operationId: string,
    amount: number,
    now = new Date(),
  ) {
    const referenceKey = `reserve:${operationId}`;
    const existing = await this.credits.findOne({ creatorId, referenceKey });
    if (existing) return { balanceAfter: existing.balanceAfter };
    await this.ensureBalance(creatorId, now);
    const result = await this.balances.findOneAndUpdate(
      { _id: creatorId, balance: { $gte: amount } },
      { $inc: { balance: -amount }, $set: { updatedAt: now } },
      { returnDocument: "after" },
    );
    if (!result)
      throw new InsufficientCreditsError(
        amount,
        await this.currentBalance(creatorId),
      );
    const balanceAfter = result.balance;
    try {
      await this.credits.insertOne(
        this.entry(
          creatorId,
          operationId,
          "reserve",
          -amount,
          balanceAfter,
          referenceKey,
          now,
        ),
      );
    } catch (error) {
      const raced = await this.credits.findOne({ creatorId, referenceKey });
      if (!raced) {
        await this.balances.updateOne(
          { _id: creatorId },
          { $inc: { balance: amount }, $set: { updatedAt: now } },
        );
        throw error;
      }
      await this.balances.updateOne(
        { _id: creatorId },
        { $inc: { balance: amount }, $set: { updatedAt: now } },
      );
      return { balanceAfter: raced.balanceAfter };
    }
    return { balanceAfter };
  }

  async consume(creatorId: string, operationId: string, now = new Date()) {
    const referenceKey = `consume:${operationId}`;
    if (await this.credits.findOne({ creatorId, referenceKey })) return;
    const reservation = await this.credits.findOne({
      creatorId,
      referenceKey: `reserve:${operationId}`,
    });
    if (
      !reservation ||
      (await this.credits.findOne({
        creatorId,
        referenceKey: `release:${operationId}`,
      }))
    )
      throw new Error("Credit reservation is not available");
    try {
      await this.credits.insertOne(
        this.entry(
          creatorId,
          operationId,
          "consume",
          0,
          reservation.balanceAfter,
          referenceKey,
          now,
        ),
      );
    } catch {
      if (!(await this.credits.findOne({ creatorId, referenceKey })))
        throw new Error("Credit settlement could not be recorded");
    }
  }

  async release(creatorId: string, operationId: string, now = new Date()) {
    const referenceKey = `release:${operationId}`;
    if (
      (await this.credits.findOne({ creatorId, referenceKey })) ||
      (await this.credits.findOne({
        creatorId,
        referenceKey: `consume:${operationId}`,
      }))
    )
      return;
    const reservation = await this.credits.findOne({
      creatorId,
      referenceKey: `reserve:${operationId}`,
    });
    if (!reservation) return;
    const amount = Math.abs(reservation.amount);
    const updated = await this.balances.findOneAndUpdate(
      { _id: creatorId },
      { $inc: { balance: amount }, $set: { updatedAt: now } },
      { returnDocument: "after" },
    );
    if (!updated) throw new Error("Credit balance is unavailable");
    try {
      await this.credits.insertOne(
        this.entry(
          creatorId,
          operationId,
          "release",
          amount,
          updated.balance,
          referenceKey,
          now,
        ),
      );
    } catch {
      if (!(await this.credits.findOne({ creatorId, referenceKey }))) {
        await this.balances.updateOne(
          { _id: creatorId },
          { $inc: { balance: -amount }, $set: { updatedAt: now } },
        );
        throw new Error("Credit release could not be recorded");
      }
    }
  }

  async refund(
    creatorId: string,
    operationId: string,
    amount: number,
    now = new Date(),
  ) {
    const referenceKey = `refund:${operationId}`;
    if (await this.credits.findOne({ creatorId, referenceKey })) return;
    const updated = await this.balances.findOneAndUpdate(
      { _id: creatorId },
      { $inc: { balance: amount }, $set: { updatedAt: now } },
      { returnDocument: "after" },
    );
    if (!updated) throw new Error("Credit balance is unavailable");
    try {
      await this.credits.insertOne(
        this.entry(
          creatorId,
          operationId,
          "refund",
          amount,
          updated.balance,
          referenceKey,
          now,
        ),
      );
    } catch {
      if (!(await this.credits.findOne({ creatorId, referenceKey })))
        throw new Error("Credit refund could not be recorded");
    }
  }

  async reconcileStuckReservations(olderThan: Date, now = new Date()) {
    const reserves = await this.credits
      .find({ entryType: "reserve", occurredAt: { $lt: olderThan } })
      .toArray();
    const result: StuckReservation[] = [];
    for (const reserve of reserves) {
      if (!reserve.operationId) continue;
      const settled = await this.credits.findOne({
        creatorId: reserve.creatorId,
        referenceKey: {
          $in: [
            `consume:${reserve.operationId}`,
            `release:${reserve.operationId}`,
          ],
        },
      });
      if (settled) continue;
      result.push({
        creatorId: reserve.creatorId,
        operationId: reserve.operationId,
        reservedAt: reserve.occurredAt,
      });
      await this.release(reserve.creatorId, reserve.operationId, now);
    }
    return result;
  }

  private async ensureBalance(creatorId: string, now: Date) {
    const existing = await this.balances.findOne({ _id: creatorId });
    if (existing) return existing;
    const entries = await this.credits.find({ creatorId }).toArray();
    const balance = entries.reduce((total, entry) => total + entry.amount, 0);
    await this.balances.updateOne(
      { _id: creatorId },
      { $setOnInsert: { _id: creatorId, creatorId, balance, updatedAt: now } },
      { upsert: true },
    );
    return this.balances.findOne({ _id: creatorId });
  }

  private async currentBalance(creatorId: string) {
    return (await this.balances.findOne({ _id: creatorId }))?.balance ?? 0;
  }

  private entry(
    creatorId: string,
    operationId: string,
    entryType: CreditEntryType,
    amount: number,
    balanceAfter: number,
    referenceKey: string,
    now: Date,
  ): CreditLedgerEntry {
    return {
      _id: randomUUID(),
      creatorId,
      operationId,
      entryType,
      amount,
      balanceAfter,
      referenceKey,
      occurredAt: now,
      createdAt: now,
      updatedAt: now,
    };
  }
}
