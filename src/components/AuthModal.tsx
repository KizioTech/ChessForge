import React, { useState } from "react";
import { Lock, Mail, ShieldCheck, X, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { isConfigured, signInWithPassword, signUpWithPassword, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  function resetForm() {
    setEmail("");
    setPassword("");
    setStatus("idle");
    setErrorMessage("");
    setShowPassword(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setStatus("loading");
    setErrorMessage("");

    const { error } =
      mode === "signin"
        ? await signInWithPassword(email.trim(), password)
        : await signUpWithPassword(email.trim(), password);

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    } else {
      resetForm();
      onClose();
    }
  }

  async function handleGoogleSignIn() {
    setStatus("loading");
    setErrorMessage("");

    const { error } = await signInWithGoogle();
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    }
    // OAuth redirects the browser — no need to close modal
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: "36px",
    background: "var(--raised)",
    border: "1px solid var(--line)",
    borderRadius: "6px",
    padding: "0 12px 0 34px",
    color: "var(--text)",
    fontSize: "12px"
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={e => {
        if (e.target === e.currentTarget) {
          resetForm();
          onClose();
        }
      }}
    >
      <section className="import-modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <div className="modal-head">
          <div>
            <div className="eyebrow">
              <ShieldCheck size={13} /> AUTHENTICATION
            </div>
            <h2 id="auth-modal-title">
              {mode === "signin" ? "Sign in to ChessForge" : "Create your account"}
            </h2>
            <p>Access your personal game library, spaced repetition review queue, and training analytics.</p>
          </div>
          <button className="icon-btn" onClick={() => { resetForm(); onClose(); }} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        {!isConfigured ? (
          <div className="platform-connect" style={{ padding: "20px 0" }}>
            <div className="platform-mark" style={{ background: "#d87570", color: "#101820" }}>!</div>
            <strong>Supabase Unconfigured</strong>
            <p>Add your <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env</code> to enable authentication.</p>
            <div className="modal-footer" style={{ borderTop: "none", padding: "16px 0 0" }}>
              <button className="button button-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        ) : (
          <>
            {/* Google OAuth button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={status === "loading"}
              style={{
                width: "100%",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                background: "var(--raised)",
                border: "1px solid var(--line)",
                borderRadius: "6px",
                color: "var(--text)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                marginTop: "16px",
                transition: "border-color .15s"
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.41l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              margin: "16px 0",
              fontSize: "11px",
              color: "var(--muted)"
            }}>
              <div style={{ flex: 1, height: "1px", background: "var(--line)" }} />
              or continue with email
              <div style={{ flex: 1, height: "1px", background: "var(--line)" }} />
            </div>

            {/* Email + password form */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--muted)", marginBottom: "6px" }}>
                  Email Address
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Mail size={16} style={{ position: "absolute", left: "10px", color: "var(--muted)" }} />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={inputStyle}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--muted)", marginBottom: "6px" }}>
                  Password
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Lock size={16} style={{ position: "absolute", left: "10px", color: "var(--muted)" }} />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder={mode === "signup" ? "At least 6 characters" : "Enter your password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ ...inputStyle, paddingRight: "36px" }}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "8px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--muted)",
                      padding: "2px",
                      display: "flex"
                    }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {status === "error" && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--red)", fontSize: "11px" }}>
                  <AlertCircle size={15} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                className="button button-primary"
                disabled={status === "loading" || !email || !password}
                style={{ width: "100%", height: "38px", justifyContent: "center" }}
              >
                {status === "loading" ? (
                  <Loader2 size={14} className="spin" />
                ) : mode === "signin" ? (
                  "Sign in"
                ) : (
                  "Create account"
                )}
              </button>
            </form>

            {/* Toggle sign-in / sign-up */}
            <div style={{ textAlign: "center", fontSize: "12px", color: "var(--muted)", padding: "14px 0 4px" }}>
              {mode === "signin" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("signup"); setStatus("idle"); setErrorMessage(""); }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--lime)",
                      cursor: "pointer",
                      fontSize: "12px",
                      textDecoration: "underline"
                    }}
                  >
                    Create one
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("signin"); setStatus("idle"); setErrorMessage(""); }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--lime)",
                      cursor: "pointer",
                      fontSize: "12px",
                      textDecoration: "underline"
                    }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
