
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
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);

    try {
      if (mode === "forgot") {
        const result = await authApi.forgotPassword(email);
        setMessage(
          result.message ||
            "If an eligible account exists, reset instructions will be sent."
        );
        return;
      }

      if (mode === "register") {
        await authApi.register(name, email, password);
      }

      const result = await authApi.login(email, password);
      onLogin(result.user);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const isRegister = mode === "register";
  const isForgot = mode === "forgot";

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">
            <ShieldCheck size={25} />
          </span>
          <div>
            <strong>trustvault</strong>
            <small>SECURE DOCUMENT WORKSPACE</small>
          </div>
        </div>

        <div className="auth-heading">
          <span className="auth-lock">
            <LockKeyhole size={20} />
          </span>

          <h1>
            {isForgot
              ? "Reset your password"
              : isRegister
                ? "Create your account"
                : "Welcome back"}
          </h1>

          <p>
            {isForgot
              ? "Enter your account email to request a password-reset link."
              : isRegister
                ? "Create an account to manage your documents securely."
                : "Sign in to access your secure document workspace."}
          </p>
        </div>

        {error && (
          <div className="notice auth-error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
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

          {!isForgot && (
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={isRegister ? 12 : undefined}
                maxLength={72}
                required
              />
              {isRegister && (
                <small className="auth-hint">
                  Use at least 12 characters.
                </small>
              )}
            </label>
          )}

          <button
            className="primary-button auth-submit"
            type="submit"
            disabled={busy}
          >
            {busy
              ? "Please wait..."
              : isForgot
                ? "Send reset link"
                : isRegister
                  ? "Create account"
                  : "Sign in securely"}
          </button>
        </form>

        {mode === "login" && (
          <p className="auth-switch">
            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setError("");
                setMessage("");
              }}
            >
              Forgot password?
            </button>
          </p>
        )}

        <p className="auth-switch">
          {isForgot
            ? "Remember your password?"
            : isRegister
              ? "Already have an account?"
              : "New to TrustVault?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(isForgot || isRegister ? "login" : "register");
              setError("");
              setMessage("");
              setPassword("");
            }}
          >
            {isForgot || isRegister ? "Sign in" : "Create account"}
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
