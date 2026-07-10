"use client";
// app/(auth)/forgot-password/page.tsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OTPInput, OTPTimer } from "@/components/shared/OTPInput";

type Step = "input" | "otp" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep]         = useState<Step>("input");
  const [target, setTarget]     = useState("");  // email or phone
  const [isPhone, setIsPhone]   = useState(false);
  const [otp, setOtp]           = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [timerKey, setTimerKey] = useState(0);
  const [canResend, setCanResend] = useState(false);

  function detectType(val: string) {
    // If purely digits, treat as phone
    setIsPhone(/^\d+$/.test(val.trim()));
    setTarget(val);
    setError(null);
  }

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const normalizedTarget = isPhone
      ? target.trim().replace(/^(\+91|91)/, "")
      : target.trim().toLowerCase();

    if (isPhone && !/^[6-9]\d{9}$/.test(normalizedTarget)) {
      setError("Enter a valid 10-digit Indian phone number.");
      setLoading(false);
      return;
    }
    if (!isPhone && !normalizedTarget.endsWith("@thapar.edu")) {
      setError("Only @thapar.edu email addresses are allowed.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: normalizedTarget,
          type:   "PASSWORD_RESET",
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setTarget(normalizedTarget);
      setStep("otp");
      setTimerKey(k => k + 1);
      setCanResend(false);
    } catch { setError("Failed to send OTP. Please try again."); }
    finally { setLoading(false); }
  }

  async function handleResend() {
    setLoading(true);
    setOtp("");
    setOtpError(null);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, type: "PASSWORD_RESET" }),
      });
      const data = await res.json();
      if (!res.ok) { setOtpError(data.error); return; }
      setTimerKey(k => k + 1);
      setCanResend(false);
    } finally { setLoading(false); }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) { setOtpError("Enter the 6-digit OTP"); return; }
    setLoading(true);
    setOtpError(null);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, code: otp, type: "PASSWORD_RESET" }),
      });
      const data = await res.json();
      if (!res.ok) { setOtpError(data.error); return; }

      // Verified — go to reset page, pass target via query
      router.push(`/reset-password?target=${encodeURIComponent(target)}`);
    } catch { setOtpError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  return (
    <div style={pageStyle}>
      <NavBar onBack={() => router.push("/login")} />

      <div style={cardWrap}>
        <div style={card}>

          {/* ── STEP 1: Enter email or phone ── */}
          {step === "input" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔑</div>
                <h1 style={heading}>Forgot your password?</h1>
                <p style={subtext}>
                  Enter your Thapar email (students) or phone number (vendors) and we will send you an OTP to reset your password.
                </p>
              </div>

              {error && <ErrorBox>{error}</ErrorBox>}

              <form onSubmit={handleSendOTP} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Email or phone number</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="102003045@thapar.edu or 9876543210"
                    value={target}
                    onChange={e => detectType(e.target.value)}
                    required
                    autoFocus
                  />
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    {isPhone && target.length > 0
                      ? "📱 Sending to phone via SMS"
                      : "📧 Sending to email"}
                  </p>
                </div>

                <button type="submit" disabled={loading} className="btn-primary" style={{ padding: "13px", fontSize: 15 }}>
                  {loading ? "Sending OTP..." : "Send OTP →"}
                </button>
              </form>

              <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", marginTop: 20 }}>
                Remember your password?{" "}
                <button onClick={() => router.push("/login")} style={linkBtn}>Sign in</button>
              </p>
            </>
          )}

          {/* ── STEP 2: Enter OTP ── */}
          {step === "otp" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>{isPhone ? "📱" : "📧"}</div>
                <h2 style={heading}>Enter OTP</h2>
                <p style={subtext}>
                  We sent a 6-digit OTP to<br />
                  <strong style={{ color: "var(--text-primary)" }}>{isPhone ? `+91 ${target}` : target}</strong>
                </p>
              </div>

              <form onSubmit={handleVerifyOTP} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <OTPInput value={otp} onChange={setOtp} disabled={loading} error={otpError} />

                <div style={{ textAlign: "center" }}>
                  {!canResend ? (
                    <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      OTP expires in{" "}
                      <OTPTimer key={timerKey} seconds={600} onExpire={() => setCanResend(true)} />
                    </p>
                  ) : (
                    <p style={{ fontSize: 13, color: "var(--red)" }}>OTP expired.</p>
                  )}
                </div>

                <button type="submit" disabled={loading || otp.length !== 6} className="btn-primary" style={{ padding: "13px", fontSize: 15 }}>
                  {loading ? "Verifying..." : "Verify OTP →"}
                </button>
              </form>

              <div style={{ textAlign: "center", marginTop: 16, display: "flex", justifyContent: "center", gap: 16 }}>
                <button onClick={handleResend} disabled={!canResend || loading}
                  style={{ fontSize: 13, color: canResend ? "var(--primary)" : "var(--text-muted)", fontWeight: 600, background: "none", border: "none", cursor: canResend ? "pointer" : "not-allowed" }}>
                  Resend OTP
                </button>
                <button onClick={() => { setStep("input"); setOtp(""); setOtpError(null); }}
                  style={{ fontSize: 13, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}>
                  Change {isPhone ? "number" : "email"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────
const pageStyle: React.CSSProperties = { minHeight: "100vh", backgroundColor: "var(--bg-page)", display: "flex", flexDirection: "column" };
const cardWrap: React.CSSProperties  = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px 60px" };
const card: React.CSSProperties      = { background: "var(--bg-card)", borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.08)", border: "1px solid var(--border)" };
const heading: React.CSSProperties   = { fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 6px", letterSpacing: "-0.02em" };
const subtext: React.CSSProperties   = { fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 };
const linkBtn: React.CSSProperties   = { color: "var(--primary)", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontSize: 13 };

function NavBar({ onBack }: { onBack: () => void }) {
  return (
    <nav style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "0 24px", height: 64, display: "flex", alignItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18 }}>M</div>
        <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>MessLess</span>
      </button>
      <button onClick={onBack} style={{ fontSize: 13, color: "var(--text-secondary)", background: "none", border: "1px solid var(--border)", padding: "7px 16px", borderRadius: 8, cursor: "pointer" }}>← Back to login</button>
    </nav>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div style={{    background: "var(--red-bg)", border: "1px solid var(--red-border)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--red)", marginBottom: 12 }}>{children}</div>;
}
