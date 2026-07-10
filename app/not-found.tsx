import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 72, fontWeight: 800, color: "var(--border)", marginBottom: 8, letterSpacing: "-0.03em" }}>404</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Page not found</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/browse" style={{ display: "inline-block", padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700, background: "var(--primary)", color: "#FFFFFF", textDecoration: "none" }}>
          Go Home
        </Link>
      </div>
    </main>
  );
}
