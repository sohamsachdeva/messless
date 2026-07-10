"use client";
import { useRouter } from "next/navigation";

export default function UnauthorizedPage() {
  const router = useRouter();
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 64, fontWeight: 800, color: "var(--border)", marginBottom: 8 }}>403</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Access Denied</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>You don&apos;t have permission to view this page.</p>
        <button className="btn-primary" onClick={() => router.push("/browse")}>
          Go Home
        </button>
      </div>
    </main>
  );
}
