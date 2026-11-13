import Link from "next/link";
import { AuthForm } from "../../components/auth-form";

export default function LoginPage() {
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
          <div className="eyebrow">Welcome back</div>
          <h2>Pick up your signal.</h2>
          <p className="helper">
            Sign in to keep your ideas and audience context close.
          </p>
          <AuthForm mode="login" />
          <p className="form-note">
            New here?{" "}
            <Link href="/signup">
              <u>Create an account</u>
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
