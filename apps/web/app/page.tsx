import Link from "next/link";

export default function HomePage() {
  return (
    <main className="site-shell">
      <nav className="nav">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            CP
          </span>
          CreatorPulse
        </Link>
        <div className="nav-links">
          <Link href="/login">Sign in</Link>
          <Link className="button button-soft" href="/signup">
            Get started
          </Link>
        </div>
      </nav>
      <section className="hero">
        <div>
          <div className="eyebrow">A sharper signal for every creator</div>
          <h1>Make content that sounds like you.</h1>
          <p className="lead">
            CreatorPulse turns audience signals into grounded ideas, in the
            language and rhythm your community already loves.
          </p>
          <div className="actions">
            <Link className="button button-primary" href="/signup">
              Build your pulse →
            </Link>
            <Link className="button button-quiet" href="/login">
              I already have an account
            </Link>
          </div>
        </div>
        <div className="signal-card">
          <div className="signal-top">
            <span>WEEKLY SIGNAL / 01</span>
            <span>LIVE</span>
          </div>
          <div className="signal-line" />
          <h2>Local detail wins.</h2>
          <p className="helper">
            Your audience is saving practical, regional stories this week.
          </p>
        </div>
      </section>
    </main>
  );
}
