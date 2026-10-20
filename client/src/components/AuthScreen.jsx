import { useState } from "react";
import { ShieldCheck, LockKeyhole } from "lucide-react";
import { authApi } from "../services/api";

export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (mode === "register") {
        await authApi.register(name, email, password);
      }

      const result =
        mode === "register"
          ? await authApi.login(email, password)
          : await authApi.login(email, password);

      onLogin(result.user);
    } catch (err) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark"><ShieldCheck size={25} /></span>
          <div>
            <strong>trustvault</strong>
            <small>SECURE DOCUMENT WORKSPACE</small>
          </div>
        </div>

        <div className="auth-heading">
          <span className="auth-lock"><LockKeyhole size={20} /></span>
          <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p>
            {mode === "login"
              ? "Sign in to access your secure document workspace."
              : "Create an account to start managing your documents securely."}
          </p>
        </div>

        {error && <div className="notice auth-error" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <label>
              Full name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={100}
                autoComplete="name"
                required
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "register" ? 12 : undefined}
              maxLength={72}
              required
            />
            {mode === "register" && (
              <small className="auth-hint">Use at least 12 characters.</small>
            )}
          </label>

          <button className="primary-button auth-submit" type="submit" disabled={busy}>
            {busy
              ? "Please wait..."
              : mode === "login"
                ? "Sign in securely"
                : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "login" ? "New to TrustVault?" : "Already have an account?"}
          {" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Create account" : "Sign in"}
          </button>
        </p>

        <div className="auth-security">
          <LockKeyhole size={15} />
          Your session is protected by a server-managed cookie.
        </div>
      </section>
    </main>
  );
}
