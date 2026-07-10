"use client";
// components/shared/OTPInput.tsx
// Reusable OTP box — 6 individual digit inputs with auto-advance

import { useRef, useState, useEffect } from "react";

type OTPInputProps = {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  error?: string | null;
};

export function OTPInput({ value, onChange, disabled, error }: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

  // Demo mode — auto-fill 123456 in development
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && !value) {
      onChange("123456");
    }
  }, [value, onChange]);

  function handleChange(idx: number, char: string) {
    if (!/^\d*$/.test(char)) return;
    const next = [...digits];
    next[idx] = char.slice(-1);
    onChange(next.join(""));
    if (char && idx < 5) inputRefs.current[idx + 1]?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      onChange(pasted);
      inputRefs.current[5]?.focus();
    }
    e.preventDefault();
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            disabled={disabled}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={handlePaste}
            style={{
              width: 44, height: 52, textAlign: "center", fontSize: 22, fontWeight: 700,
              border: error ? "1.5px solid var(--red)" : d ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
              borderRadius: 10, outline: "none", background: disabled ? "var(--bg-page)" : "var(--bg-card)",
              color: "var(--text-primary)", transition: "border-color 0.15s",
              fontFamily: "monospace",
            }}
          />
        ))}
      </div>
      {error && <p style={{ fontSize: 12, color: "var(--red)", textAlign: "center", marginTop: 8 }}>{error}</p>}
    </div>
  );
}

// ── Password field with show/hide toggle ─────────────────────
type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
};

export function PasswordField({ label, value, onChange, placeholder = "••••••••", error, hint, required }: PasswordFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{label}</label>
        {hint && <span style={{ fontSize: 11, color: "var(--text-light)" }}>{hint}</span>}
      </div>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="input"
          style={{ paddingRight: 44 }}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", fontSize: 16,
            color: "var(--text-muted)", padding: 4, lineHeight: 1,
          }}
          tabIndex={-1}
          title={show ? "Hide password" : "Show password"}
        >
          {show ? "🙈" : "👁️"}
        </button>
      </div>
      {error && <p style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>{error}</p>}
    </div>
  );
}

// ── Password strength bar ────────────────────────────────────
export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const checks = [
    { label: "8+ characters",    pass: password.length >= 8          },
    { label: "Uppercase letter", pass: /[A-Z]/.test(password)        },
    { label: "Number",           pass: /\d/.test(password)           },
    { label: "Special char",     pass: /[^a-zA-Z0-9]/.test(password) },
  ];
  const score = checks.filter(c => c.pass).length;
  const barColors = ["var(--red)", "var(--red)", "var(--amber)", "var(--green)", "var(--green)"];

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= score ? barColors[score] : "var(--border)", transition: "background 0.2s" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {checks.map(c => (
          <span key={c.label} style={{ fontSize: 11, color: c.pass ? "var(--green)" : "var(--text-light)", display: "flex", alignItems: "center", gap: 3 }}>
            {c.pass ? "✓" : "○"} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── OTP countdown timer ──────────────────────────────────────
export function OTPTimer({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return; }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onExpire]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <span style={{ fontSize: 12, color: remaining < 60 ? "var(--red)" : "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
      {mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
}
