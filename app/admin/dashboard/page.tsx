"use client";
// app/admin/dashboard/page.tsx

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type Stats = {
  pendingVendors: number;
  pendingMenuItems: number;
  totalVendors: number;
  totalOrders: number;
  totalStudents: number;
};

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;
    if ((session?.user as any)?.role !== "ADMIN") { router.push("/"); return; }
    fetch("/api/admin/stats").then(r => r.json()).then(setStats).finally(() => setLoading(false));
  }, [status, session, router]);

  if (loading) return <div className="centered-state"><div className="spinner" /></div>;

  const cards = [
    { label: "Pending vendor approvals", value: stats?.pendingVendors ?? 0, color: "var(--amber)", bg: "var(--amber-bg)", href: "/admin/vendors",    emoji: "🏪", urgent: (stats?.pendingVendors ?? 0) > 0 },
    { label: "Pending menu items",       value: stats?.pendingMenuItems ?? 0, color: "var(--blue)", bg: "var(--blue-bg)", href: "/admin/menu-items", emoji: "🍽️", urgent: (stats?.pendingMenuItems ?? 0) > 0 },
    { label: "Total vendors",            value: stats?.totalVendors ?? 0,    color: "var(--green)", bg: "var(--green-bg)", href: "/admin/vendors",    emoji: "✅", urgent: false },
    { label: "Total orders",             value: stats?.totalOrders ?? 0,     color: "var(--primary)", bg: "var(--primary-bg)", href: "/orders",           emoji: "📦", urgent: false },
    { label: "Registered students",      value: stats?.totalStudents ?? 0,color: "var(--text-secondary)", bg: "var(--bg-elevated)", href: "#", emoji: "🎓", urgent: false },
  ];

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)" }}>
      <div style={{ background: "linear-gradient(135deg, var(--hero-bg) 0%, #000000 100%)", padding: "32px 24px 40px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={{ fontSize: 13, color: "var(--hero-text-muted)", marginBottom: 4 }}>Admin panel</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--hero-text)", letterSpacing: "-0.03em" }}>MessLess Dashboard</h1>
          <p style={{ fontSize: 14, color: "var(--hero-text-muted)", marginTop: 4 }}>Welcome back, {session?.user?.name?.split(" ")[0]}</p>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "-20px auto 0", padding: "0 20px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
          {cards.map((card) => (
            <Link key={card.label} href={card.href}
              style={{
                background: "var(--bg-card)", border: card.urgent ? `1.5px solid ${card.color}` : "1px solid var(--border)",
                borderRadius: 16, padding: "20px", textAlign: "left", cursor: card.href !== "#" ? "pointer" : "default",
                boxShadow: card.urgent ? `0 4px 20px ${card.color}20` : "0 1px 4px rgba(0,0,0,0.06)",
                transition: "all 0.15s", textDecoration: "none", color: "inherit", display: "block",
                pointerEvents: card.href === "#" ? "none" : "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>{card.emoji}</span>
                {card.urgent && <span style={{ fontSize: 10, fontWeight: 700, background: card.bg, color: card.color, padding: "3px 8px", borderRadius: 20 }}>Action needed</span>}
              </div>
              <p style={{ fontSize: 32, fontWeight: 800, color: card.urgent ? card.color : "var(--text-primary)", letterSpacing: "-0.03em", marginBottom: 4 }}>{card.value}</p>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{card.label}</p>
            </Link>
          ))}
        </div>

        {/* Quick action buttons */}
        <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/admin/vendors" className="btn-primary" style={{ padding: "12px 20px", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            Review vendor registrations →
          </Link>
          <Link href="/admin/menu-items" className="btn-outline" style={{ padding: "12px 20px", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            Review menu items →
          </Link>
        </div>
      </div>
    </main>
  );
}
