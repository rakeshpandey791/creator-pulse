import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { BadRequestException, ConflictException } from "@nestjs/common";

export const FREE_PLAN_ID = "9f4e5c8b-3f7b-4f2a-9b31-000000000001";
export const CREATOR_PLAN_ID = "9f4e5c8b-3f7b-4f2a-9b31-000000000002";
export const GENERATION_OPERATION = "generation" as const;

export type Plan = {
  _id: string;
  code: string;
  name: string;
  monthlyCredits: number;
  isFree: boolean;
  isActive: boolean;
  priceMinor: number;
  currency: string;
  featureFlags: { generationCost: number };
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type Subscription = {
  _id: string;
  creatorId: string;
  planId: string;
  status:
    "active" | "trialing" | "past_due" | "cancelled" | "expired" | "manual";
  periodStart: Date;
  periodEnd: Date;
  creditsGranted: number;
  provider: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreditLedgerEntry = {
  _id: string;
  creatorId: string;
  entryType:
    | "grant"
    | "reserve"
    | "consume"
    | "release"
    | "refund"
    | "adjustment"
    | "expiry";
  amount: number;
  balanceAfter: number;
  referenceKey?: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type CreditsResponse = {
  balance: number;
  renewalAt: string;
  plan: {
    id: string;
    code: string;
    name: string;
    monthlyCredits: number;
    priceMinor: number;
    currency: string;
    version: number;
  };
  operationCosts: { generation: number };
  recentActivity: Array<{
    entryType: CreditLedgerEntry["entryType"];
    amount: number;
    occurredAt: string;
  }>;
};

export type PaymentStatus =
  "created" | "pending" | "succeeded" | "failed" | "cancelled";

export type PaymentTransaction = {
  _id: string;
  creatorId: string;
  subscriptionId?: string;
  transactionType: "checkout" | "renewal" | "refund" | "manual_adjustment";
  status: PaymentStatus;
  amountMinor: number;
  currency: string;
  provider: string;
  providerTransactionId?: string;
  idempotencyKey: string;
  failureCode?: string;
  metadata?: Record<string, string>;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type CommercialAuditEvent = {
  _id: string;
  eventType: string;
  occurredAt: Date;
  createdAt: Date;
  actorType: "user" | "admin" | "system" | "worker";
  actorId?: string;
  action: string;
  result: "success" | "failure";
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, string>;
};

export interface CommercialStore {
  listActivePlans(): Promise<Plan[]>;
  findActiveSubscription(
    creatorId: string,
    now: Date,
  ): Promise<Subscription | null>;
  createSubscription(subscription: Subscription): Promise<Subscription>;
  updateSubscription(
    subscriptionId: string,
    update: Partial<Subscription>,
  ): Promise<Subscription>;
  findCreditByReference(
    creatorId: string,
    referenceKey: string,
  ): Promise<CreditLedgerEntry | null>;
  insertCredit(entry: CreditLedgerEntry): Promise<CreditLedgerEntry>;
  listCredits(creatorId: string): Promise<CreditLedgerEntry[]>;
  findPaymentByIdempotency(
    creatorId: string,
    idempotencyKey: string,
  ): Promise<PaymentTransaction | null>;
  findPaymentByProviderId(
    providerTransactionId: string,
  ): Promise<PaymentTransaction | null>;
  createPayment(payment: PaymentTransaction): Promise<PaymentTransaction>;
  updatePayment(
    paymentId: string,
    update: Partial<PaymentTransaction>,
  ): Promise<PaymentTransaction>;
  recordAudit(event: CommercialAuditEvent): Promise<void>;
}

export type CheckoutOutcome = "success" | "pending" | "failed";

export interface PaymentAdapter {
  createCheckout(input: {
    creatorId: string;
    plan: Plan;
    idempotencyKey: string;
    outcome: CheckoutOutcome;
    now: Date;
  }): Promise<{
    provider: string;
    providerTransactionId: string;
    status: PaymentStatus;
    failureCode?: string;
  }>;
}

export class MockManualPaymentAdapter implements PaymentAdapter {
  async createCheckout(input: {
    creatorId: string;
    plan: Plan;
    idempotencyKey: string;
    outcome: CheckoutOutcome;
    now: Date;
  }) {
    void input.creatorId;
    void input.plan;
    void input.now;
    return {
      provider: "mock-manual",
      providerTransactionId: `mock_${input.idempotencyKey}`,
      status: input.outcome === "success" ? "succeeded" : input.outcome,
      ...(input.outcome === "failed"
        ? { failureCode: "MOCK_PAYMENT_FAILED" }
        : {}),
    } as const;
  }
}

export interface GenerationCreditPolicy {
  ensureEntitlement(creatorId: string, now?: Date): Promise<void>;
  generationCost(): Promise<number>;
}

export class CommercialService implements GenerationCreditPolicy {
  constructor(
    private readonly store: CommercialStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listPlans() {
    return (await this.store.listActivePlans()).map((plan) => ({
      id: plan._id,
      code: plan.code,
      name: plan.name,
      monthlyCredits: plan.monthlyCredits,
      isFree: plan.isFree,
      priceMinor: plan.priceMinor,
      currency: plan.currency,
      operationCosts: { generation: plan.featureFlags.generationCost },
      version: plan.version,
    }));
  }

  async generationCost() {
    const plan = await this.resolvePlan();
    return plan.featureFlags.generationCost;
  }

  async ensureEntitlement(creatorId: string, now = this.now()) {
    const existing = await this.store.findActiveSubscription(creatorId, now);
    if (existing) return;
    const plan = await this.resolvePlan();
    const periodStart = startOfMonth(now);
    const periodEnd = startOfNextMonth(now);
    const subscription: Subscription = {
      _id: randomUUID(),
      creatorId,
      planId: plan._id,
      status: "active",
      periodStart,
      periodEnd,
      creditsGranted: plan.monthlyCredits,
      provider: "internal",
      createdAt: now,
      updatedAt: now,
    };
    try {
      await this.store.createSubscription(subscription);
    } catch {
      if (await this.store.findActiveSubscription(creatorId, now)) return;
      throw new Error("Could not create creator entitlement");
    }
    const referenceKey = `grant:${creatorId}:${periodStart.toISOString()}:${plan.version}`;
    if (await this.store.findCreditByReference(creatorId, referenceKey)) return;
    const existingGrant = (await this.store.listCredits(creatorId)).some(
      (entry) =>
        entry.entryType === "grant" &&
        entry.occurredAt >= periodStart &&
        entry.occurredAt < periodEnd,
    );
    if (existingGrant) return;
    await this.store.insertCredit({
      _id: randomUUID(),
      creatorId,
      entryType: "grant",
      amount: plan.monthlyCredits,
      balanceAfter: plan.monthlyCredits,
      referenceKey,
      occurredAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  async getCredits(creatorId: string): Promise<CreditsResponse> {
    const now = this.now();
    await this.ensureEntitlement(creatorId, now);
    const subscription = await this.store.findActiveSubscription(
      creatorId,
      now,
    );
    if (!subscription) throw new Error("Creator entitlement is unavailable");
    const plan = await this.planById(subscription.planId);
    const entries = await this.store.listCredits(creatorId);
    return {
      balance: Math.max(
        0,
        entries.reduce((total, entry) => total + entry.amount, 0),
      ),
      renewalAt: subscription.periodEnd.toISOString(),
      plan: {
        id: plan._id,
        code: plan.code,
        name: plan.name,
        monthlyCredits: plan.monthlyCredits,
        priceMinor: plan.priceMinor,
        currency: plan.currency,
        version: plan.version,
      },
      operationCosts: { generation: plan.featureFlags.generationCost },
      recentActivity: entries
        .sort(
          (left, right) =>
            right.occurredAt.getTime() - left.occurredAt.getTime(),
        )
        .slice(0, 20)
        .map((entry) => ({
          entryType: entry.entryType,
          amount: entry.amount,
          occurredAt: entry.occurredAt.toISOString(),
        })),
    };
  }

  async checkout(
    creatorId: string,
    planId: string,
    idempotencyKey: string,
    adapter: PaymentAdapter,
    outcome: CheckoutOutcome = "success",
    now = this.now(),
  ) {
    if (!idempotencyKey.trim() || idempotencyKey.length > 200)
      throw new BadRequestException(
        "Idempotency-Key is required and must be bounded",
      );
    const existing = await this.store.findPaymentByIdempotency(
      creatorId,
      idempotencyKey,
    );
    if (existing) return this.paymentResponse(existing);
    const plan = (await this.store.listActivePlans()).find(
      (item) => item._id === planId,
    );
    if (!plan || plan.isFree)
      throw new BadRequestException("Choose an active paid plan");
    const providerResult = await adapter.createCheckout({
      creatorId,
      plan,
      idempotencyKey,
      outcome,
      now,
    });
    const payment: PaymentTransaction = {
      _id: randomUUID(),
      creatorId,
      transactionType: "checkout",
      status: providerResult.status,
      amountMinor: plan.priceMinor,
      currency: plan.currency,
      provider: providerResult.provider,
      providerTransactionId: providerResult.providerTransactionId,
      idempotencyKey,
      metadata: { planId: plan._id },
      ...(providerResult.failureCode
        ? { failureCode: providerResult.failureCode }
        : {}),
      createdAt: now,
      updatedAt: now,
      ...(providerResult.status === "succeeded" ? { completedAt: now } : {}),
    };
    let created: PaymentTransaction;
    try {
      created = await this.store.createPayment(payment);
    } catch {
      const raced = await this.store.findPaymentByIdempotency(
        creatorId,
        idempotencyKey,
      );
      if (raced) return this.paymentResponse(raced);
      throw new ConflictException("Payment checkout could not be recorded");
    }
    await this.store.recordAudit({
      _id: randomUUID(),
      eventType: "payment.checkout",
      occurredAt: now,
      createdAt: now,
      actorType: "user",
      actorId: creatorId,
      action: "checkout",
      result: created.status === "failed" ? "failure" : "success",
      targetType: "payment_transaction",
      targetId: created._id,
      metadata: { status: created.status, planId: plan._id },
    });
    if (created.status === "succeeded") {
      await this.activatePaidSubscription(creatorId, plan, created, now);
      created =
        (await this.store.findPaymentByIdempotency(
          creatorId,
          idempotencyKey,
        )) ?? created;
    }
    return this.paymentResponse(created);
  }

  async settlePayment(
    providerTransactionId: string,
    status: "succeeded" | "failed",
    now = this.now(),
  ) {
    const payment = await this.store.findPaymentByProviderId(
      providerTransactionId,
    );
    if (!payment)
      throw new BadRequestException("Payment transaction not found");
    if (payment.status === "succeeded" || payment.status === "failed")
      return this.paymentResponse(payment);
    const updated = await this.store.updatePayment(payment._id, {
      status,
      updatedAt: now,
      ...(status === "succeeded"
        ? { completedAt: now }
        : { failureCode: "MOCK_PAYMENT_FAILED" }),
    });
    await this.store.recordAudit({
      _id: randomUUID(),
      eventType: "payment.webhook",
      occurredAt: now,
      createdAt: now,
      actorType: "system",
      action: "settle_payment",
      result: status === "failed" ? "failure" : "success",
      targetType: "payment_transaction",
      targetId: payment._id,
      metadata: { status },
    });
    if (status === "succeeded") {
      const plan = await this.planByIdFromPayment(updated);
      await this.activatePaidSubscription(
        updated.creatorId,
        plan,
        updated,
        now,
      );
    }
    return this.paymentResponse(
      (await this.store.findPaymentByProviderId(providerTransactionId)) ??
        updated,
    );
  }

  async cancelSubscription(creatorId: string, now = this.now()) {
    const subscription = await this.store.findActiveSubscription(
      creatorId,
      now,
    );
    if (!subscription)
      throw new BadRequestException("No active subscription to cancel");
    const cancelled = await this.store.updateSubscription(subscription._id, {
      status: "cancelled",
      updatedAt: now,
    });
    await this.store.recordAudit({
      _id: randomUUID(),
      eventType: "subscription.cancel",
      occurredAt: now,
      createdAt: now,
      actorType: "user",
      actorId: creatorId,
      action: "cancel_subscription",
      result: "success",
      targetType: "subscription",
      targetId: cancelled._id,
    });
    return {
      subscriptionId: cancelled._id,
      status: cancelled.status,
      periodEnd: cancelled.periodEnd.toISOString(),
    };
  }

  async subscription(creatorId: string, now = this.now()) {
    const subscription = await this.store.findActiveSubscription(
      creatorId,
      now,
    );
    if (!subscription) return { status: "none" as const };
    const plan = await this.planById(subscription.planId);
    return {
      status: subscription.status,
      subscriptionId: subscription._id,
      plan: { id: plan._id, code: plan.code, name: plan.name },
      periodStart: subscription.periodStart.toISOString(),
      periodEnd: subscription.periodEnd.toISOString(),
      creditsGranted: subscription.creditsGranted,
    };
  }

  private async resolvePlan() {
    const plans = await this.store.listActivePlans();
    const free = plans.find((plan) => plan.isFree);
    if (!free) throw new Error("No active free plan is configured");
    return free;
  }

  private async planById(id: string) {
    const plan = (await this.store.listActivePlans()).find(
      (item) => item._id === id,
    );
    if (!plan) throw new Error("Subscription plan is unavailable");
    return plan;
  }

  private async planByIdFromPayment(payment: PaymentTransaction) {
    const planId = payment.metadata?.planId;
    if (!planId) throw new Error("Payment is missing plan metadata");
    return this.planById(planId);
  }

  private async activatePaidSubscription(
    creatorId: string,
    plan: Plan,
    payment: PaymentTransaction,
    now: Date,
  ) {
    if (payment.subscriptionId) return;
    const existing = await this.store.findActiveSubscription(creatorId, now);
    if (existing && existing.planId === plan._id) {
      await this.store.updatePayment(payment._id, {
        subscriptionId: existing._id,
        updatedAt: now,
      });
      return;
    }
    const subscription: Subscription = {
      _id: randomUUID(),
      creatorId,
      planId: plan._id,
      status: "active",
      periodStart: startOfMonth(now),
      periodEnd: startOfNextMonth(now),
      creditsGranted: plan.monthlyCredits,
      provider: payment.provider,
      createdAt: now,
      updatedAt: now,
    };
    const current = await this.store.findActiveSubscription(creatorId, now);
    const created = current
      ? await this.store.updateSubscription(current._id, {
          planId: plan._id,
          status: "active",
          periodStart: subscription.periodStart,
          periodEnd: subscription.periodEnd,
          creditsGranted: subscription.creditsGranted,
          provider: subscription.provider,
          updatedAt: now,
        })
      : await this.store.createSubscription(subscription);
    const referenceKey = `grant:${creatorId}:${created.periodStart.toISOString()}:${plan.version}:${payment._id}`;
    if (!(await this.store.findCreditByReference(creatorId, referenceKey))) {
      await this.store.insertCredit({
        _id: randomUUID(),
        creatorId,
        entryType: "grant",
        amount: plan.monthlyCredits,
        balanceAfter:
          (await this.store.listCredits(creatorId)).reduce(
            (sum, entry) => sum + entry.amount,
            0,
          ) + plan.monthlyCredits,
        referenceKey,
        occurredAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    await this.store.updatePayment(payment._id, {
      subscriptionId: created._id,
      updatedAt: now,
    });
  }

  private paymentResponse(payment: PaymentTransaction) {
    return {
      transactionId: payment._id,
      providerTransactionId: payment.providerTransactionId,
      status: payment.status,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      ...(payment.failureCode ? { failureCode: payment.failureCode } : {}),
      ...(payment.subscriptionId
        ? { subscriptionId: payment.subscriptionId }
        : {}),
    };
  }
}

export class InMemoryCommercialStore implements CommercialStore {
  readonly plans = new Map<string, Plan>();
  readonly subscriptions = new Map<string, Subscription>();
  readonly credits: CreditLedgerEntry[] = [];
  readonly payments = new Map<string, PaymentTransaction>();
  readonly auditLogs: CommercialAuditEvent[] = [];

  constructor() {
    const now = new Date("2026-11-01T00:00:00.000Z");
    const plans = defaultPlans(now);
    for (const plan of plans) this.plans.set(plan._id, plan);
  }

  async listActivePlans() {
    return [...this.plans.values()].filter((plan) => plan.isActive);
  }

  async findActiveSubscription(creatorId: string, now: Date) {
    return (
      [...this.subscriptions.values()].find(
        (subscription) =>
          subscription.creatorId === creatorId &&
          ["active", "trialing", "manual"].includes(subscription.status) &&
          subscription.periodEnd > now,
      ) ?? null
    );
  }

  async createSubscription(subscription: Subscription) {
    const existing = await this.findActiveSubscription(
      subscription.creatorId,
      subscription.periodStart,
    );
    if (existing) return existing;
    this.subscriptions.set(subscription._id, subscription);
    return subscription;
  }

  async updateSubscription(id: string, update: Partial<Subscription>) {
    const current = this.subscriptions.get(id);
    if (!current) throw new Error("Subscription not found");
    const next = { ...current, ...update };
    this.subscriptions.set(id, next);
    return next;
  }

  async findCreditByReference(creatorId: string, referenceKey: string) {
    return (
      this.credits.find(
        (entry) =>
          entry.creatorId === creatorId && entry.referenceKey === referenceKey,
      ) ?? null
    );
  }

  async insertCredit(entry: CreditLedgerEntry) {
    this.credits.push(entry);
    return entry;
  }

  async listCredits(creatorId: string) {
    return this.credits.filter((entry) => entry.creatorId === creatorId);
  }

  async findPaymentByIdempotency(creatorId: string, idempotencyKey: string) {
    return (
      [...this.payments.values()].find(
        (payment) =>
          payment.creatorId === creatorId &&
          payment.idempotencyKey === idempotencyKey,
      ) ?? null
    );
  }

  async findPaymentByProviderId(providerTransactionId: string) {
    return (
      [...this.payments.values()].find(
        (payment) => payment.providerTransactionId === providerTransactionId,
      ) ?? null
    );
  }

  async createPayment(payment: PaymentTransaction) {
    const existing = await this.findPaymentByIdempotency(
      payment.creatorId,
      payment.idempotencyKey,
    );
    if (existing) return existing;
    this.payments.set(payment._id, payment);
    return payment;
  }

  async updatePayment(id: string, update: Partial<PaymentTransaction>) {
    const current = this.payments.get(id);
    if (!current) throw new Error("Payment not found");
    const next = { ...current, ...update };
    this.payments.set(id, next);
    return next;
  }

  async recordAudit(event: CommercialAuditEvent) {
    this.auditLogs.push(event);
  }
}

export class MongoCommercialStore implements CommercialStore {
  constructor(private readonly db: Db) {}

  listActivePlans() {
    return this.db
      .collection<Plan>("subscription_plans")
      .find({ isActive: true })
      .sort({ isFree: -1, priceMinor: 1, version: -1 })
      .toArray();
  }

  findActiveSubscription(creatorId: string, now: Date) {
    return this.db.collection<Subscription>("creator_subscriptions").findOne({
      creatorId,
      status: { $in: ["active", "trialing", "manual"] },
      periodEnd: { $gt: now },
    });
  }

  async createSubscription(subscription: Subscription) {
    await this.db
      .collection<Subscription>("creator_subscriptions")
      .insertOne(subscription);
    return subscription;
  }

  async updateSubscription(id: string, update: Partial<Subscription>) {
    const result = await this.db
      .collection<Subscription>("creator_subscriptions")
      .findOneAndUpdate(
        { _id: id },
        { $set: update },
        { returnDocument: "after" },
      );
    if (!result) throw new Error("Subscription not found");
    return result;
  }

  findCreditByReference(creatorId: string, referenceKey: string) {
    return this.db.collection<CreditLedgerEntry>("credit_ledger").findOne({
      creatorId,
      referenceKey,
    });
  }

  async insertCredit(entry: CreditLedgerEntry) {
    await this.db
      .collection<CreditLedgerEntry>("credit_ledger")
      .insertOne(entry);
    return entry;
  }

  listCredits(creatorId: string) {
    return this.db
      .collection<CreditLedgerEntry>("credit_ledger")
      .find({ creatorId })
      .sort({ occurredAt: -1 })
      .limit(100)
      .toArray();
  }

  findPaymentByIdempotency(creatorId: string, idempotencyKey: string) {
    return this.db
      .collection<PaymentTransaction>("payment_transactions")
      .findOne({ creatorId, idempotencyKey });
  }

  findPaymentByProviderId(providerTransactionId: string) {
    return this.db
      .collection<PaymentTransaction>("payment_transactions")
      .findOne({ providerTransactionId });
  }

  async createPayment(payment: PaymentTransaction) {
    await this.db
      .collection<PaymentTransaction>("payment_transactions")
      .insertOne(payment);
    return payment;
  }

  async updatePayment(id: string, update: Partial<PaymentTransaction>) {
    const result = await this.db
      .collection<PaymentTransaction>("payment_transactions")
      .findOneAndUpdate(
        { _id: id },
        { $set: update },
        { returnDocument: "after" },
      );
    if (!result) throw new Error("Payment not found");
    return result;
  }

  async recordAudit(event: CommercialAuditEvent) {
    await this.db
      .collection<CommercialAuditEvent>("audit_logs")
      .insertOne(event);
  }
}

export function defaultPlans(now = new Date()): Plan[] {
  return [
    {
      _id: FREE_PLAN_ID,
      code: "free",
      name: "Free creator",
      monthlyCredits: 12,
      isFree: true,
      isActive: true,
      priceMinor: 0,
      currency: "INR",
      featureFlags: { generationCost: 3 },
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: CREATOR_PLAN_ID,
      code: "creator",
      name: "Creator",
      monthlyCredits: 60,
      isFree: false,
      isActive: true,
      priceMinor: 49900,
      currency: "INR",
      featureFlags: { generationCost: 3 },
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function startOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function startOfNextMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1));
}
