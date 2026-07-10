"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 72, fontWeight: 800, color: "var(--border)", marginBottom: 8, letterSpacing: "-0.03em" }}>500</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={() => reset()}
          style={{ display: "inline-block", padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700, background: "var(--primary)", color: "#FFFFFF", border: "none", cursor: "pointer" }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
