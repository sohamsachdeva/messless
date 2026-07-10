"use client";
// app/(auth)/login/page.tsx
// UPDATED: adds Forgot Password link + show/hide password + vendor OTP register

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { OTPInput, PasswordField, OTPTimer } from "@/components/shared/OTPInput";
import ThemeToggle from "@/components/shared/ThemeToggle";

type Tab      = "student" | "vendor";
type VendorFlow = "login" | "register";
type RegisterStep = "form" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<Tab>("student");

  useEffect(() => {
    if (status === "authenticated") {
      const role = (session?.user as any)?.role;
      if (role === "VENDOR")      router.replace("/vendor/dashboard");
      else if (role === "ADMIN")  router.replace("/admin/dashboard");
      else                        router.replace("/browse");
    }
  }, [status, session, router]);

  if (status === "loading") return null;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)", display: "flex", flexDirection: "column" }}>

      {/* Navbar */}
      <nav style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18 }}>M</div>
          <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>MessLess</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ThemeToggle />
          <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>Made by Thapar, for Thapar</span>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ backgroundColor: "var(--hero-bg)", padding: "56px 24px 80px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.07) 0%, transparent 40%)", pointerEvents: "none" }} />
        <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, color: "var(--hero-text)", letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 12, position: "relative" }}>
          Order food. Skip the queue.<br />
          <span style={{ color: "var(--hero-text-muted)" }}>Made for Thapar.</span>
        </h1>
        <p style={{ fontSize: 16, color: "var(--hero-text-muted)", marginBottom: 32, position: "relative" }}>
          Browse cafeterias, order ahead, pay online.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", position: "relative" }}>
          {[{ name: "COS", emoji: "⚽", desc: "Sports complex" }, { name: "Aahar", emoji: "🍱", desc: "Main food court" }, { name: "G Block", emoji: "☕", desc: "Quick bites" }, { name: "Jaggis", emoji: "🍔", desc: "Fast food spot" }].map(hub => (
            <div key={hub.name} onClick={() => document.getElementById("login-card")?.scrollIntoView({ behavior: "smooth" })} style={{ background: "var(--bg-card)", borderRadius: 16, padding: "14px 18px", minWidth: 110, textAlign: "left", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", cursor: "pointer" }}>
              <div style={{ fontSize: 26, marginBottom: 4 }}>{hub.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{hub.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{hub.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Login card */}
      <div id="login-card" style={{ display: "flex", justifyContent: "center", marginTop: -40, padding: "0 20px 60px", position: "relative", zIndex: 10 }}>
        <div style={{ background: "var(--bg-card)", borderRadius: 20, width: "100%", maxWidth: 440, boxShadow: "0 8px 40px rgba(0,0,0,0.12)", border: "1px solid var(--border)", overflow: "hidden" }}>

          {/* Tab switcher */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
            {(["student", "vendor"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "16px", fontSize: 14, fontWeight: 700, background: "none", border: "none", cursor: "pointer", borderBottom: tab === t ? "2.5px solid var(--primary)" : "2.5px solid transparent", color: tab === t ? "var(--primary)" : "var(--text-muted)", transition: "all 0.15s" }}>
                {t === "student" ? "🎓 Student" : "🏪 Vendor"}
              </button>
            ))}
          </div>

          <div style={{ padding: "28px 28px 24px" }}>
            {tab === "student" ? <StudentLogin /> : <VendorSection />}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div style={{ backgroundColor: "var(--bg-card)", borderTop: "1px solid var(--border)", padding: "48px 24px" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", textAlign: "center", marginBottom: 32 }}>How MessLess works</h2>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap", maxWidth: 800, margin: "0 auto" }}>
          {[{ step: "1", emoji: "🏪", title: "Pick a hub", desc: "COS, Aahar, G Block or Jaggis" }, { step: "2", emoji: "🛒", title: "Browse & order", desc: "Add items to cart" }, { step: "3", emoji: "💳", title: "Pay online", desc: "UPI, card or wallet" }, { step: "4", emoji: "✅", title: "Pickup or delivery", desc: "Skip the queue" }].map(item => (
            <div key={item.step} style={{ textAlign: "center", maxWidth: 150 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--primary-bg)", margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{item.emoji}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", marginBottom: 3, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Step {item.step}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: "var(--hero-bg)", padding: "20px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>© 2025 MessLess · Made with ❤️ at Thapar University</p>
      </div>
    </div>
  );
}

// ── Student login ─────────────────────────────────────────────
function StudentLogin() {
  const router = useRouter();
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Show registered=true message
  const searchParams = null as any;
  const registered = searchParams?.get("registered") === "true";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.endsWith("@thapar.edu")) { setError("Only @thapar.edu emails are allowed."); return; }
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { login: email, password, redirect: false });
    setLoading(false);
    if (res?.error) setError("Invalid email or password.");
    else router.push("/browse");
  }

  return (
    <>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>Student sign in</h2>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>Use your @thapar.edu email</p>

      {registered && <div style={{ background: "var(--green-bg)", border: "1px solid var(--green-border)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--green)", marginBottom: 16 }}>✅ Account created! Please sign in.</div>}
      {error && <ErrorBox>{error}</ErrorBox>}

      <button onClick={() => signIn("google", { callbackUrl: "/browse" })} style={googleBtnStyle}>
        <GoogleIcon /> Continue with Google
      </button>
      <Divider />

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={labelStyle}>Email</label>
          <input className="input" type="email" placeholder="102003045@thapar.edu" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={labelStyle}>Password</label>
            <button type="button" onClick={() => router.push("/forgot-password")} style={{ fontSize: 12, color: "var(--primary)", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
              Forgot password?
            </button>
          </div>
          <PasswordField label="" value={password} onChange={setPassword} required />
        </div>

        <button type="submit" disabled={loading} className="btn-primary" style={{ padding: "12px", fontSize: 14, marginTop: 4 }}>
          {loading ? "Signing in..." : "Sign in →"}
        </button>
      </form>

      <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", marginTop: 16 }}>
        New student?{" "}
        <button onClick={() => router.push("/register")} style={linkBtnStyle}>Register here</button>
      </p>
    </>
  );
}

// ── Vendor section: login + register with OTP ─────────────────
function VendorSection() {
  const router = useRouter();
  const [flow, setFlow]               = useState<VendorFlow>("login");
  const [registerStep, setRegisterStep] = useState<RegisterStep>("form");

  // Login state
  const [phone, setPhone]             = useState("");
  const [password, setPassword]       = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError]   = useState<string | null>(null);

  // Register state
  const [shopName, setShopName]       = useState("");
  const [regPhone, setRegPhone]       = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm]   = useState("");
  const [otp, setOtp]                 = useState("");
  const [otpError, setOtpError]       = useState<string | null>(null);
  const [regLoading, setRegLoading]   = useState(false);
  const [regError, setRegError]       = useState<string | null>(null);
  const [timerKey, setTimerKey]       = useState(0);
  const [canResend, setCanResend]     = useState(false);
  const [regSuccess, setRegSuccess]   = useState(false);

  // ── Vendor login ─────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleaned)) { setLoginError("Enter a valid 10-digit phone number."); return; }
    setLoginLoading(true);
    setLoginError(null);
    const res = await signIn("credentials", {
      login: cleaned,
      password,
      redirect: false,
    });
    setLoginLoading(false);
    if (res?.error) setLoginError("Invalid phone or password. If you just registered, wait for admin approval.");
    else router.push("/vendor/dashboard");
  }

  // ── Send OTP for vendor register ─────────────────────────────
  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = regPhone.replace(/\D/g, "");
    if (!shopName.trim() || shopName.trim().length < 2) { setRegError("Enter a valid shop name."); return; }
    if (!/^[6-9]\d{9}$/.test(cleaned)) { setRegError("Enter a valid 10-digit phone number."); return; }
    if (regPassword.length < 8) { setRegError("Password must be at least 8 characters."); return; }
    if (regPassword !== regConfirm) { setRegError("Passwords do not match."); return; }

    setRegLoading(true);
    setRegError(null);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: cleaned, type: "PHONE_VERIFY" }),
      });
      const data = await res.json();
      if (!res.ok) { setRegError(data.error); return; }
      setRegPhone(cleaned);
      setRegisterStep("otp");
      setTimerKey(k => k + 1);
      setCanResend(false);
    } catch { setRegError("Failed to send OTP. Please try again."); }
    finally { setRegLoading(false); }
  }

  async function handleResend() {
    setRegLoading(true);
    setOtp("");
    setOtpError(null);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: regPhone, type: "PHONE_VERIFY" }),
      });
      const data = await res.json();
      if (!res.ok) { setOtpError(data.error); return; }
      setTimerKey(k => k + 1);
      setCanResend(false);
    } finally { setRegLoading(false); }
  }

  async function handleVerifyAndRegister(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) { setOtpError("Enter the 6-digit OTP"); return; }
    setRegLoading(true);
    setOtpError(null);
    try {
      // Verify OTP
      const vRes = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: regPhone, code: otp, type: "PHONE_VERIFY" }),
      });
      const vData = await vRes.json();
      if (!vRes.ok) { setOtpError(vData.error); return; }

      // Register vendor
      const rRes = await fetch("/api/auth/vendor-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: regPhone, password: regPassword, shopName }),
      });
      const rData = await rRes.json();
      if (!rRes.ok) { setOtpError(rData.error); return; }

      setRegSuccess(true);
    } catch { setOtpError("Something went wrong. Please try again."); }
    finally { setRegLoading(false); }
  }

  // ── Success screen ──
  if (regSuccess) {
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Registration submitted!</h3>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
          Your shop <strong>{shopName}</strong> is pending admin approval. You will be able to log in once approved — usually within 24 hours.
        </p>
        <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--amber)", textAlign: "left", marginBottom: 20 }}>
          📱 Registered with: +91 {regPhone}
        </div>
        <button onClick={() => { setFlow("login"); setRegSuccess(false); setRegisterStep("form"); }} style={{ ...linkBtnStyle, fontSize: 14 }}>
          Back to vendor login
        </button>
      </div>
    );
  }

  return (
    <>
      {/* ── Vendor LOGIN ── */}
      {flow === "login" && (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>Vendor sign in</h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>Login with your registered phone number</p>

          {loginError && <ErrorBox>{loginError}</ErrorBox>}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>WhatsApp / phone number</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--text-secondary)", fontWeight: 600, zIndex: 1 }}>+91</span>
                <input className="input" type="tel" placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} required style={{ paddingLeft: 44 }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={labelStyle}>Password</label>
                <button type="button" onClick={() => router.push("/forgot-password")} style={{ fontSize: 12, color: "var(--primary)", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                  Forgot password?
                </button>
              </div>
              <PasswordField label="" value={password} onChange={setPassword} required />
            </div>

            <button type="submit" disabled={loginLoading} className="btn-primary" style={{ padding: "12px", fontSize: 14 }}>
              {loginLoading ? "Signing in..." : "Sign in →"}
            </button>
          </form>

          <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", marginTop: 16 }}>
            New vendor?{" "}
            <button onClick={() => { setFlow("register"); setRegisterStep("form"); }} style={linkBtnStyle}>Register your shop</button>
          </p>
        </>
      )}

      {/* ── Vendor REGISTER — step 1: form ── */}
      {flow === "register" && registerStep === "form" && (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>Register your shop</h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>Use the phone you accept WhatsApp orders on</p>

          <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--amber)", lineHeight: 1.5 }}>
            ℹ️ Admin will review and approve your shop. You can login once approved.
          </div>

          {regError && <ErrorBox>{regError}</ErrorBox>}

          <form onSubmit={handleSendOTP} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Shop / stall name *</label>
              <input className="input" type="text" placeholder="e.g. Dessert Club" value={shopName} onChange={e => setShopName(e.target.value)} required />
            </div>

            <div>
              <label style={labelStyle}>WhatsApp / phone number *</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--text-secondary)", fontWeight: 600 }}>+91</span>
                <input className="input" type="tel" placeholder="9876543210" value={regPhone} onChange={e => setRegPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} required style={{ paddingLeft: 44 }} />
              </div>
            </div>

            <PasswordField label="Password *" value={regPassword} onChange={setRegPassword} hint="Min 8 chars" required />
            <PasswordField label="Confirm password *" value={regConfirm} onChange={setRegConfirm} required />

            <button type="submit" disabled={regLoading} className="btn-primary" style={{ padding: "12px", fontSize: 14 }}>
              {regLoading ? "Sending OTP..." : "Send verification OTP →"}
            </button>
          </form>

          <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", marginTop: 16 }}>
            Already registered?{" "}
            <button onClick={() => setFlow("login")} style={linkBtnStyle}>Sign in</button>
          </p>
        </>
      )}

      {/* ── Vendor REGISTER — step 2: OTP ── */}
      {flow === "register" && registerStep === "otp" && (
        <>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>Verify your number</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              We sent a 6-digit OTP to<br />
              <strong style={{ color: "var(--text-primary)" }}>+91 {regPhone}</strong>
            </p>
          </div>

          <form onSubmit={handleVerifyAndRegister} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <OTPInput value={otp} onChange={setOtp} disabled={regLoading} error={otpError} />

            <div style={{ textAlign: "center" }}>
              {!canResend ? (
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  OTP expires in <OTPTimer key={timerKey} seconds={600} onExpire={() => setCanResend(true)} />
                </p>
              ) : (
                <p style={{ fontSize: 13, color: "var(--red)" }}>OTP expired.</p>
              )}
            </div>

            <button type="submit" disabled={regLoading || otp.length !== 6} className="btn-primary" style={{ padding: "12px", fontSize: 14 }}>
              {regLoading ? "Verifying..." : "Verify & submit registration →"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 16, display: "flex", justifyContent: "center", gap: 16 }}>
            <button onClick={handleResend} disabled={!canResend || regLoading} style={{ fontSize: 13, color: canResend ? "var(--primary)" : "var(--text-light)", fontWeight: 600, background: "none", border: "none", cursor: canResend ? "pointer" : "not-allowed" }}>
              Resend OTP
            </button>
            <button onClick={() => { setRegisterStep("form"); setOtp(""); setOtpError(null); }} style={{ fontSize: 13, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}>
              Change number
            </button>
          </div>
        </>
      )}
    </>
  );
}

// ── Shared helpers ────────────────────────────────────────────
const labelStyle: React.CSSProperties    = { fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" };
const linkBtnStyle: React.CSSProperties  = { color: "var(--primary)", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontSize: 13 };
const googleBtnStyle: React.CSSProperties = { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "11px 16px", border: "1.5px solid var(--border)", borderRadius: 10, background: "var(--bg-card)", fontSize: 14, fontWeight: 600, color: "var(--text-primary)", cursor: "pointer", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

function Divider() {
  return <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}><div style={{ flex: 1, height: 1, background: "var(--border)" }} /><span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>or</span><div style={{ flex: 1, height: 1, background: "var(--border)" }} /></div>;
}
function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "var(--red-bg)", border: "1px solid var(--red-border)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--red)", marginBottom: 12 }}>{children}</div>;
}
function GoogleIcon() {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/><path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>;
}
