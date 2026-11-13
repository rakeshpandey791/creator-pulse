"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  commercialApi,
  getAccessToken,
  type PaymentCheckoutResponse,
  type Plan,
  type SubscriptionStatus,
} from "../../../lib/api";
import { DiscoveryShell } from "../../../components/discovery-ui";
import { Alert, Button, Panel } from "../../../components/primitives";

function priceLabel(plan: Plan) {
  return plan.priceMinor === 0
    ? "Free"
    : `₹${Math.round(plan.priceMinor / 100).toLocaleString("en-IN")}/month`;
}

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(
    null,
  );
  const [selectedOutcome, setSelectedOutcome] = useState<
    "success" | "pending" | "failed"
  >("success");
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentCheckoutResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    Promise.all([commercialApi.plans(), commercialApi.subscription(token)])
      .then(([nextPlans, nextSubscription]) => {
        setPlans(nextPlans);
        setSubscription(nextSubscription);
      })
      .catch((cause) =>
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Plans could not be loaded.",
        ),
      );
  }, []);

  async function checkout(plan: Plan) {
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setPendingPlan(plan.id);
    setError("");
    setResult(null);
    try {
      const idempotencyKey =
        window.crypto?.randomUUID?.() ?? `checkout-${Date.now()}`;
      const response = await commercialApi.checkout(
        token,
        plan.id,
        idempotencyKey,
        selectedOutcome,
      );
      setResult(response);
      if (response.status === "succeeded")
        setSubscription(await commercialApi.subscription(token));
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Checkout could not start. Your current access is unchanged.",
      );
    } finally {
      setPendingPlan(null);
    }
  }

  async function cancel() {
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setError("");
    try {
      await commercialApi.cancel(token);
      setSubscription(await commercialApi.subscription(token));
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Your subscription could not be cancelled.",
      );
    }
  }

  return (
    <DiscoveryShell active="usage">
      <header className="page-heading billing-heading">
        <div>
          <div className="eyebrow">Workspace / Plans</div>
          <h1>Choose room to create.</h1>
          <p className="lead">
            Keep the free plan for steady idea work, or add more monthly drafts
            when your publishing rhythm picks up.
          </p>
        </div>
        {subscription?.status && subscription.status !== "none" && (
          <span className="subscription-stamp">{subscription.status} plan</span>
        )}
      </header>
      <div className="manual-payment-note">
        <strong>Mock checkout for now.</strong> No card details are collected.
        This preview lets you see success, delayed confirmation, and failure
        states before a real payment provider is connected.
      </div>
      {error && <Alert>{error}</Alert>}
      {result && (
        <div
          className={`billing-result billing-result-${result.status}`}
          role="status"
        >
          <strong>
            {result.status === "succeeded"
              ? "Your plan is active."
              : result.status === "pending"
                ? "Payment is waiting for confirmation."
                : "Payment did not go through."}
          </strong>
          <span>
            {result.status === "failed"
              ? "No credits or subscription changes were made. You can try again."
              : result.status === "pending"
                ? "We will keep your current access until confirmation arrives."
                : "Your monthly credits are ready to use."}
          </span>
        </div>
      )}
      <div className="plan-grid">
        {plans.map((plan) => {
          const current =
            subscription?.plan?.id === plan.id &&
            subscription.status !== "cancelled";
          return (
            <Panel
              as="article"
              className={`plan-card ${plan.isFree ? "plan-card-free" : "plan-card-featured"}`}
              key={plan.id}
            >
              <div className="plan-card-topline">
                <span className="section-kicker">
                  {plan.isFree ? "Start here" : "For a regular rhythm"}
                </span>
                {current && <span className="status-pill">Current</span>}
              </div>
              <h2>{plan.name}</h2>
              <p className="plan-price">{priceLabel(plan)}</p>
              <p className="plan-description">
                {plan.monthlyCredits} credits each month. A generated draft
                costs {plan.operationCosts.generation} credits.
              </p>
              <ul className="plan-features">
                <li>See your credit balance before every draft</li>
                <li>Credits renew monthly</li>
                <li>Unused access stays clear and visible</li>
              </ul>
              {!plan.isFree && (
                <Button
                  disabled={pendingPlan === plan.id || current}
                  onClick={() => void checkout(plan)}
                >
                  {pendingPlan === plan.id
                    ? "Starting checkout…"
                    : current
                      ? "Your current plan"
                      : "Choose Creator plan →"}
                </Button>
              )}
            </Panel>
          );
        })}
      </div>
      {subscription?.status &&
        subscription.status !== "none" &&
        subscription.status !== "cancelled" && (
          <div className="billing-cancel-row">
            <span>
              Need to pause paid access? Cancellation takes effect without
              deleting your current history.
            </span>
            <Button
              variant="quiet"
              className="text-button"
              onClick={() => void cancel()}
            >
              Cancel subscription
            </Button>
          </div>
        )}
      {!result && plans.some((plan) => !plan.isFree) && (
        <label className="mock-outcome">
          <span>Preview checkout result</span>
          <select
            value={selectedOutcome}
            onChange={(event) =>
              setSelectedOutcome(event.target.value as typeof selectedOutcome)
            }
          >
            <option value="success">Complete now</option>
            <option value="pending">Wait for confirmation</option>
            <option value="failed">Show payment failure</option>
          </select>
        </label>
      )}
    </DiscoveryShell>
  );
}
