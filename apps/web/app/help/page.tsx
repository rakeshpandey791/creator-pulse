import Link from "next/link";
import { DiscoveryShell } from "../../components/discovery-ui";

export default function HelpPage() {
  return (
    <DiscoveryShell active="today">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Support</div>
          <h1>How can we help?</h1>
          <p className="detail-summary">
            Need a hand with your ideas, profile, or drafts? Start with your
            creative context, or return to Today and keep creating.
          </p>
        </div>
      </div>
      <Link className="button button-primary" href="/app">
        Back to Today →
      </Link>
    </DiscoveryShell>
  );
}
