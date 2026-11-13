import Link from "next/link";
import { AuthForm } from "../../components/auth-form";

export default function SignupPage() {
  return (
    <main className="site-shell">
      <nav className="nav">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            CP
          </span>
          CreatorPulse
        </Link>
      </nav>
      <section className="auth-layout">
        <div className="auth-card">
          <div className="eyebrow">Start with context</div>
          <h2>Your next good idea starts here.</h2>
          <p className="helper">
            A few quick details help us make your first signal useful.
          </p>
          <AuthForm mode="signup" />
          <p className="form-note">
            Already have an account?{" "}
            <Link href="/login">
              <u>Sign in</u>
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
