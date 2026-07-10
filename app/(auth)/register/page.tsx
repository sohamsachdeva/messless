"use client";
// app/(auth)/register/page.tsx
// Student registration with email OTP verification

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { OTPInput, PasswordField, PasswordStrength, OTPTimer } from "@/components/shared/OTPInput";

type Step = "form" | "otp" | "done";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");

  // Form fields
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [thaparId, setThaparId]   = useState("");
  const [phone, setPhone]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");

  // OTP state
  const [otp, setOtp]             = useState("");
  const [otpError, setOtpError]   = useState<string | null>(null);
  const [timerKey, setTimerKey]   = useState(0);
  const [canResend, setCanResend] = useState(false);

  // Loading / errors
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Validation ──────────────────────────────────────────────
  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errs.name = "Name must be at least 2 characters";
    if (!email.endsWith("@thapar.edu")) errs.email = "Only @thapar.edu emails allowed";
    if (thaparId && !/^[\d]{10}$/.test(thaparId)) errs.thaparId = "Must be exactly 10 digits";
    if (phone && !/^[6-9][\d]{9}$/.test(phone)) errs.phone = "Enter valid 10-digit number";
    if (password.length < 8) errs.password = "Min 8 characters";
    if (password !== confirm) errs.confirm = "Passwords do not match";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Step 1: send OTP ────────────────────────────────────────
  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: email, type: "EMAIL_VERIFY" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setStep("otp");
      setTimerKey(k => k + 1);
      setCanResend(false);
    } catch { setError("Failed to send OTP. Please try again."); }
    finally { setLoading(false); }
  }

  // ── Resend OTP ──────────────────────────────────────────────
  async function handleResend() {
    setLoading(true);
    setOtp("");
    setOtpError(null);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: email, type: "EMAIL_VERIFY" }),
      });
      const data = await res.json();
      if (!res.ok) { setOtpError(data.error); return; }
      setTimerKey(k => k + 1);
      setCanResend(false);
    } finally { setLoading(false); }
  }

  // ── Step 2: verify OTP then register ────────────────────────
  async function handleVerifyAndRegister(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) { setOtpError("Enter the 6-digit OTP"); return; }
    setLoading(true);
    setOtpError(null);

    try {
      // Verify OTP
      const vRes = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: email, code: otp, type: "EMAIL_VERIFY" }),
      });
      const vData = await vRes.json();
      if (!vRes.ok) { setOtpError(vData.error); return; }

      // Create account
      const rRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, thaparId: thaparId || undefined, phone: phone || undefined, password }),
      });
      const rData = await rRes.json();
      if (!rRes.ok) { setOtpError(rData.error); return; }

      // Auto sign in
      const signInRes = await signIn("credentials", { email, password, redirect: false });
      if (signInRes?.ok) router.push("/browse");
      else router.push("/login?registered=true");
    } catch { setOtpError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)", display: "flex", flexDirection: "column" }}>

      {/* Navbar */}
      <nav style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <button onClick={() => router.push("/login")} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18 }}>M</div>
          <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>MessLess</span>
        </button>
        <button onClick={() => router.push("/login")} style={{ fontSize: 13, color: "var(--text-secondary)", background: "none", border: "1px solid var(--border)", padding: "7px 16px", borderRadius: 8, cursor: "pointer" }}>
          Sign in instead
        </button>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 20px 60px" }}>
        <div style={{ background: "var(--bg-card)", borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 460, boxShadow: "0 8px 40px rgba(0,0,0,0.08)", border: "1px solid var(--border)" }}>

          {/* ── Step indicator ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
            {["Details", "Verify email", "Done"].map((label, i) => {
              const stepNum = i + 1;
              const currentStepNum = step === "form" ? 1 : step === "otp" ? 2 : 3;
              const done = stepNum < currentStepNum;
              const active = stepNum === currentStepNum;
              return (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, flex: stepNum < 3 ? 1 : undefined }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: done ? "var(--primary)" : active ? "var(--primary-bg)" : "var(--bg-elevated)", color: done ? "#fff" : active ? "var(--primary)" : "var(--text-muted)", border: active ? "1.5px solid var(--primary)" : "none", flexShrink: 0 }}>
                    {done ? "✓" : stepNum}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? "var(--primary)" : done ? "var(--text-primary)" : "var(--text-muted)", whiteSpace: "nowrap" as const }}>{label}</span>
                  {stepNum < 3 && <div style={{ flex: 1, height: 1, background: done ? "var(--primary)" : "var(--border)", marginLeft: 4 }} />}
                </div>
              );
            })}
          </div>

          {/* ── STEP 1: Registration form ── */}
          {step === "form" && (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "-0.02em" }}>Create your account</h1>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24 }}>Join MessLess with your Thapar University email</p>

              {/* Google shortcut */}
              <button onClick={() => signIn("google", { callbackUrl: "/browse" })}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "11px 16px", border: "1.5px solid var(--border)", borderRadius: 10, background: "var(--bg-card)", fontSize: 14, fontWeight: 600, color: "var(--text-primary)", cursor: "pointer", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <GoogleIcon /> Continue with Google
              </button>

              <Divider label="or fill in details" />

              {error && <ErrorBox>{error}</ErrorBox>}

              <form onSubmit={handleSendOTP} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label="Full name *" error={fieldErrors.name}>
                  <input className="input" type="text" placeholder="Soham Sachdeva" value={name} onChange={e => setName(e.target.value)} required />
                </Field>

                <Field label="Thapar email *" error={fieldErrors.email}>
                  <input className="input" type="email" placeholder="102003045@thapar.edu" value={email} onChange={e => setEmail(e.target.value)} required />
                </Field>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Thapar ID" error={fieldErrors.thaparId} hint="10 digits">
                    <input className="input" type="text" placeholder="102003045" value={thaparId} onChange={e => setThaparId(e.target.value)} maxLength={10} />
                  </Field>
                  <Field label="Phone" error={fieldErrors.phone} hint="Optional">
                    <input className="input" type="tel" placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
                  </Field>
                </div>

                <PasswordField label="Password *" value={password} onChange={setPassword} error={fieldErrors.password} hint="Min 8 chars" required />
                {password && <PasswordStrength password={password} />}

                <PasswordField label="Confirm password *" value={confirm} onChange={setConfirm} error={fieldErrors.confirm} required />

                <button type="submit" disabled={loading} className="btn-primary" style={{ padding: "13px", fontSize: 15, marginTop: 4 }}>
                  {loading ? "Sending OTP..." : "Send verification OTP →"}
                </button>
              </form>

              <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", marginTop: 20 }}>
                Already have an account?{" "}
                <button onClick={() => router.push("/login")} style={{ color: "var(--primary)", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>Sign in</button>
              </p>
            </>
          )}

          {/* ── STEP 2: OTP verification ── */}
          {step === "otp" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>Check your inbox</h2>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  We sent a 6-digit OTP to<br />
                  <strong style={{ color: "var(--text-primary)" }}>{email}</strong>
                </p>
              </div>

              <form onSubmit={handleVerifyAndRegister} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <OTPInput value={otp} onChange={setOtp} disabled={loading} error={otpError} />

                {/* Timer */}
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
                  {loading ? "Verifying..." : "Verify & create account →"}
                </button>
              </form>

              <div style={{ textAlign: "center", marginTop: 16 }}>
                <button onClick={handleResend} disabled={!canResend || loading}
                  style={{ fontSize: 13, color: canResend ? "var(--primary)" : "var(--text-muted)", fontWeight: 600, background: "none", border: "none", cursor: canResend ? "pointer" : "not-allowed" }}>
                  Resend OTP
                </button>
                <span style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 8px" }}>·</span>
                <button onClick={() => { setStep("form"); setOtp(""); setOtpError(null); }}
                  style={{ fontSize: 13, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}>
                  Change email
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────
function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{label}</label>
        {hint && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{hint}</span>}
      </div>
      {children}
      {error && <p style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>{error}</p>}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "var(--red-bg)", border: "1px solid var(--red-border)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--red)", marginBottom: 4 }}>{children}</div>;
}

function Divider({ label = "or" }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
