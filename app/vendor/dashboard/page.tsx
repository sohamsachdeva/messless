"use client";
// app/vendor/dashboard/page.tsx

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type DashboardData = {
  vendor: {
    id: string;
    name: string;
    location: string;
    isApproved: boolean;
    isActive: boolean;
    phone: string | null;
  } | null;
  todayOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  pendingItems: number;
  liveItems: number;
  recentOrders: {
    id: string;
    status: string;
    totalAmount: number;
    orderMode: string;
    createdAt: string;
    user: { name: string };
    orderItems: { quantity: number; menuItem: { name: string } }[];
  }[];
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PLACED:    { bg: "var(--blue-bg)", color: "var(--blue)" },
  CONFIRMED: { bg: "var(--green-bg)", color: "var(--green)" },
  PREPARING: { bg: "var(--amber-bg)", color: "var(--amber)" },
  READY:     { bg: "var(--green-bg)", color: "var(--green)" },
  PICKED_UP: { bg: "var(--bg-elevated)", color: "var(--text-secondary)" },
  CANCELLED: { bg: "var(--red-bg)", color: "var(--red)" },
};

export default function VendorDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;
    if ((session?.user as any)?.role !== "VENDOR") { router.push("/"); return; }

    const fetchData = () =>
      fetch("/api/vendor/dashboard")
        .then(r => r.json())
        .then(d => { setData(d); setLastRefreshed(new Date()); })
        .catch(() => {})
        .finally(() => setLoading(false));

    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [status, session, router]);

  if (loading) return <div className="centered-state"><div className="spinner" /></div>;
  if (!data) return null;

  const { vendor, todayOrders, totalRevenue, todayRevenue, pendingItems, liveItems, recentOrders } = data;

  // Not yet approved
  if (!vendor?.isApproved) {
    return (
      <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "40px 32px", maxWidth: 440, textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⏳</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>Account pending approval</h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
            Your vendor registration for <strong>{vendor?.name}</strong> is under review. The admin will approve your account within 24 hours.
          </p>
          <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "var(--amber)", textAlign: "left" }}>
            📱 You registered with: {vendor?.phone ?? "your phone number"}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, var(--vendor-header-from) 0%, var(--vendor-header-to) 100%)", padding: "28px 24px 36px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={{ fontSize: 13, color: "var(--hero-text-muted)", marginBottom: 4 }}>Vendor dashboard</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--hero-text)", letterSpacing: "-0.03em", marginBottom: 4 }}>{vendor.name}</h1>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--hero-text-muted)" }}>📍 {vendor.location}</span>
            {vendor.phone && <span style={{ fontSize: 12, color: "var(--hero-text-muted)" }}>📱 {vendor.phone}</span>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "-16px auto 0", padding: "0 20px 60px" }}>

        {/* Live indicator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginBottom: 10, fontSize: 11, color: "var(--text-muted)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
          <span>Auto-refreshes every 30s</span>
          {lastRefreshed && (
            <>
              <span>·</span>
              <span>Last updated {lastRefreshed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Today's revenue", value: `₹${todayRevenue}`,      emoji: "💰", color: "var(--green)" },
            { label: "Today's orders",  value: todayOrders,              emoji: "📦", color: "var(--blue)" },
            { label: "Total revenue",   value: `₹${totalRevenue}`,       emoji: "📊", color: "var(--green)" },
            { label: "Live menu items", value: liveItems,                emoji: "✅", color: "var(--green)" },
            { label: "Pending approval",value: pendingItems,             emoji: "⏳", color: "var(--amber)" },
          ].map(stat => (
            <div key={stat.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px" }}>
              <span style={{ fontSize: 24 }}>{stat.emoji}</span>
              <p style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", margin: "8px 0 2px", letterSpacing: "-0.02em" }}>{stat.value}</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          <Link href="/vendor/menu" className="btn-primary" style={{ padding: "11px 20px", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            🍽️ Manage menu
          </Link>
          <Link href="/vendor/orders" className="btn-outline" style={{ padding: "11px 20px", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            📦 View orders
          </Link>
        </div>

        {/* Recent orders */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 12 }}>Recent orders</p>

          {recentOrders.length === 0 ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "40px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>📭</p>
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>No orders yet. Share your menu with students!</p>
            </div>
          ) : (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
              {recentOrders.map((order, idx) => {
                const sc = STATUS_COLORS[order.status] ?? STATUS_COLORS.PLACED;
                return (
                  <div key={order.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: idx < recentOrders.length - 1 ? "1px solid var(--bg-elevated)" : "none" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{order.user.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: sc.bg, color: sc.color }}>{order.status}</span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {order.orderItems.map(i => `${i.menuItem.name} ×${i.quantity}`).join(", ")}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>₹{Number(order.totalAmount).toFixed(0)}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
