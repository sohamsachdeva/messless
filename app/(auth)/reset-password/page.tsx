"use client";
// app/(auth)/reset-password/page.tsx
// Reads ?target= from URL, resets password after OTP verified

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordField, PasswordStrength } from "@/components/shared/OTPInput";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const target = searchParams?.get("target") ?? "";

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);

  useEffect(() => {
    if (!target) router.replace("/forgot-password");
  }, [target, router]);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(true);
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  if (success) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>Password reset!</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 28, lineHeight: 1.6 }}>
          Your password has been updated successfully. You can now sign in with your new password.
        </p>
        <button className="btn-primary" onClick={() => router.push("/login")} style={{ width: "100%", padding: "13px", fontSize: 15 }}>
          Go to sign in →
        </button>
      </div>
    );
  }

  const isPhone = /^\d{10}$/.test(target);

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6, letterSpacing: "-0.02em" }}>Set new password</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          For <strong style={{ color: "var(--text-primary)" }}>{isPhone ? `+91 ${target}` : target}</strong>
        </p>
      </div>

      {error && (
        <div style={{ background: "var(--red-bg)", border: "1px solid #F9C4C8", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--red)", marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <PasswordField
          label="New password *"
          value={password}
          onChange={setPassword}
          hint="Min 8 characters"
          required
        />
        {password && <PasswordStrength password={password} />}

        <PasswordField
          label="Confirm new password *"
          value={confirm}
          onChange={setConfirm}
          required
        />

        <button type="submit" disabled={loading} className="btn-primary" style={{ padding: "13px", fontSize: 15, marginTop: 4 }}>
          {loading ? "Resetting..." : "Reset password →"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
      <nav style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "0 24px", height: 64, display: "flex", alignItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <button onClick={() => router.push("/login")} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18 }}>M</div>
          <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>MessLess</span>
        </button>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px 60px" }}>
        <div style={{ background: "var(--bg-card)", borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.08)", border: "1px solid var(--border)" }}>
          <Suspense fallback={<div className="centered-state"><div className="spinner" /></div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
