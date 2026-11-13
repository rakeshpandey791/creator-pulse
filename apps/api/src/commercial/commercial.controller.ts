import { Body, Controller, Get, Headers, Inject, Post } from "@nestjs/common";
import { IdentityService } from "../identity/identity.service.js";
import {
  CommercialService,
  type CheckoutOutcome,
  type PaymentAdapter,
} from "./commercial.service.js";

export const PAYMENT_ADAPTER = "PAYMENT_ADAPTER";

@Controller()
export class CommercialController {
  constructor(
    @Inject(CommercialService) private readonly commercial: CommercialService,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(PAYMENT_ADAPTER) private readonly payments: PaymentAdapter,
  ) {}

  @Get("plans")
  plans() {
    return this.commercial.listPlans();
  }

  @Get("credits")
  async credits(@Headers("authorization") authorization?: string) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    return this.commercial.getCredits(user.id);
  }

  @Post("subscriptions/checkout")
  async checkout(
    @Body() body: { planId?: string; outcome?: CheckoutOutcome },
    @Headers("authorization") authorization?: string,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    return this.commercial.checkout(
      user.id,
      body.planId ?? "",
      idempotencyKey ?? "",
      this.payments,
      body.outcome ?? "success",
    );
  }

  @Post("subscriptions/cancel")
  async cancel(@Headers("authorization") authorization?: string) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    return this.commercial.cancelSubscription(user.id);
  }

  @Get("subscriptions")
  async subscription(@Headers("authorization") authorization?: string) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    return this.commercial.subscription(user.id);
  }

  @Post("subscriptions/webhook")
  async webhook(
    @Body()
    body: { providerTransactionId?: string; status?: "succeeded" | "failed" },
    @Headers("x-payment-webhook-secret") secret?: string,
  ) {
    if (
      (process.env.MOCK_PAYMENT_WEBHOOK_SECRET ?? "local-payment-webhook") !==
      secret
    )
      throw new Error("Invalid payment webhook secret");
    return this.commercial.settlePayment(
      body.providerTransactionId ?? "",
      body.status ?? "failed",
    );
  }
}

function bearerToken(authorization?: string): string {
  const [scheme, token] = (authorization ?? "").split(" ");
  return scheme?.toLowerCase() === "bearer" ? (token ?? "") : "";
}
