import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CommercialController } from "../apps/api/src/commercial/commercial.controller.js";
import {
  CommercialService,
  CREATOR_PLAN_ID,
  InMemoryCommercialStore,
  MockManualPaymentAdapter,
} from "../apps/api/src/commercial/commercial.service.js";

function setup() {
  const identity = {
    authenticate: vi.fn(async (token: string) => {
      if (token !== "valid-token") throw new UnauthorizedException();
      return { id: "creator-1" };
    }),
  };
  const controller = new CommercialController(
    new CommercialService(new InMemoryCommercialStore()),
    identity as never,
    new MockManualPaymentAdapter(),
  );
  return { controller, identity };
}

describe("BILL-01 subscription controller boundary", () => {
  it("requires authentication for checkout and cancellation", async () => {
    const { controller, identity } = setup();
    await expect(
      controller.checkout({ planId: CREATOR_PLAN_ID }, undefined, "checkout-1"),
    ).rejects.toThrow(UnauthorizedException);
    await expect(controller.cancel(undefined)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(identity.authenticate).toHaveBeenCalledWith("");
  });

  it("accepts authenticated checkout and protects the mock webhook", async () => {
    const { controller } = setup();
    const pending = await controller.checkout(
      { planId: CREATOR_PLAN_ID, outcome: "pending" },
      "Bearer valid-token",
      "checkout-1",
    );
    await expect(
      controller.webhook(
        {
          providerTransactionId: pending.providerTransactionId,
          status: "succeeded",
        },
        "wrong-secret",
      ),
    ).rejects.toThrow("Invalid payment webhook secret");
    const settled = await controller.webhook(
      {
        providerTransactionId: pending.providerTransactionId,
        status: "succeeded",
      },
      "local-payment-webhook",
    );
    expect(settled.status).toBe("succeeded");
  });
});
