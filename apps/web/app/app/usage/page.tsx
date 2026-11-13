"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  commercialApi,
  getAccessToken,
  type Credits,
  type SubscriptionStatus,
} from "../../../lib/api";
import {
  DiscoveryShell,
  EmptyDiscovery,
} from "../../../components/discovery-ui";
import { Alert, Button, Panel } from "../../../components/primitives";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function amountLabel(value: number) {
  return `${value > 0 ? "+" : ""}${value} credits`;
}

export default function UsagePage() {
  const [credits, setCredits] = useState<Credits | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(
    null,
  );
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    Promise.all([
      commercialApi.credits(token),
      commercialApi.subscription(token),
    ])
      .then(([nextCredits, nextSubscription]) => {
        setCredits(nextCredits);
        setSubscription(nextSubscription);
      })
      .catch((cause) =>
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Your credit usage could not be loaded.",
        ),
      );
  }, []);

  return (
    <DiscoveryShell active="usage">
      <header className="page-heading billing-heading">
        <div>
          <div className="eyebrow">Workspace / Usage</div>
          <h1>Spend with confidence.</h1>
          <p className="lead">
            See what is available, what a draft costs, and when your monthly
            credits renew.
          </p>
        </div>
        <Button href="/app/billing">
          View plans <span aria-hidden="true">→</span>
        </Button>
      </header>
      {error && <Alert>{error}</Alert>}
      {!credits && !error && (
        <div
          className="billing-skeleton"
          aria-label="Loading usage"
          aria-busy="true"
        />
      )}
      {credits && (
        <>
          <section className="usage-overview" aria-label="Credit overview">
            <Panel className="usage-balance-panel">
              <span className="section-kicker">Available now</span>
              <strong>{credits.balance}</strong>
              <span>credits</span>
              <p>
                {credits.operationCosts.generation} credits per generated draft.
              </p>
            </Panel>
            <Panel className="usage-detail-panel">
              <div>
                <span>Current plan</span>
                <strong>{credits.plan.name}</strong>
              </div>
              <div>
                <span>Monthly allowance</span>
                <strong>{credits.plan.monthlyCredits} credits</strong>
              </div>
              <div>
                <span>Renews</span>
                <strong>{dateLabel(credits.renewalAt)}</strong>
              </div>
              <div>
                <span>Subscription</span>
                <strong>
                  {subscription?.status === "none"
                    ? "Free access"
                    : (subscription?.status ?? "Checking")}
                </strong>
              </div>
            </Panel>
          </section>
          <section className="billing-section">
            <div className="billing-section-heading">
              <div>
                <div className="section-kicker">Recent movement</div>
                <h2>Where your credits went.</h2>
              </div>
              <span>Balance is authoritative</span>
            </div>
            {credits.recentActivity.length ? (
              <div className="credit-activity-list">
                {credits.recentActivity.map((entry, index) => (
                  <div
                    className="credit-activity-row"
                    key={`${entry.entryType}-${entry.occurredAt}-${index}`}
                  >
                    <span
                      className={`activity-mark activity-${entry.amount >= 0 ? "in" : "out"}`}
                      aria-hidden="true"
                    >
                      {entry.amount >= 0 ? "+" : "−"}
                    </span>
                    <div>
                      <strong>
                        {entry.entryType === "grant"
                          ? "Monthly credits"
                          : entry.entryType === "reserve"
                            ? "Draft reserved"
                            : entry.entryType === "consume"
                              ? "Draft completed"
                              : entry.entryType}
                      </strong>
                      <small>{dateLabel(entry.occurredAt)}</small>
                    </div>
                    <b>{amountLabel(entry.amount)}</b>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyDiscovery
                title="Your first credit movement will appear here."
                message="When you generate or receive credits, this timeline will keep the balance easy to understand."
              />
            )}
          </section>
        </>
      )}
    </DiscoveryShell>
  );
}
