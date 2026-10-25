
import { useState } from "react";
import { ShieldCheck, LockKeyhole, CheckCircle2 } from "lucide-react";
import { authApi } from "../services/api";

export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is missing its token. Request a new link.");
      return;
    }

    if (password.length < 12 || password.length > 72) {
      setError("Your password must be between 12 and 72 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err.message ||
          "Unable to reset your password. Request a new reset link."
      );
    } finally {
      setBusy(false);
    }
  }

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
            {success ? (
              <CheckCircle2 size={20} />
            ) : (
              <LockKeyhole size={20} />
            )}
          </span>

          <h1>{success ? "Password updated" : "Choose a new password"}</h1>

          <p>
            {success
              ? "Your password has been changed. Return to sign in using your new password."
              : "Choose a strong password to secure your TrustVault account."}
          </p>
        </div>

        {error && (
          <div className="notice auth-error" role="alert">
            {error}
          </div>
        )}

        {success ? (
          <button
            className="primary-button auth-submit"
            type="button"
            onClick={() => {
              window.location.assign("/");
            }}
          >
            Return to sign in
          </button>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              New password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={12}
                maxLength={72}
                required
              />
              <small className="auth-hint">
                Use at least 12 characters.
              </small>
            </label>

            <label>
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={12}
                maxLength={72}
                required
              />
            </label>

            <button
              className="primary-button auth-submit"
              type="submit"
              disabled={busy}
            >
              {busy ? "Updating password..." : "Update password"}
            </button>
          </form>
        )}

        {!success && (
          <p className="auth-switch">
            Remember your password?{" "}
            <button
              type="button"
              onClick={() => window.location.assign("/")}
            >
              Sign in
            </button>
          </p>
        )}

        <div className="auth-security">
          <LockKeyhole size={15} />
          Your password is protected by server-side hashing.
        </div>
      </section>
    </main>
  );
}
