"use client";

// ============================================================
// app/(student)/orders/page.tsx
// Order history — all past and current orders for the student
// ============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PLATFORM_FEE } from "@/lib/constants";

// ── Types ─────────────────────────────────────────────────────
type Order = {
  id: string;
  status: string;
  orderMode: string;
  totalAmount: number;
  createdAt: string;
  vendor: { id: string; name: string; location: string };
  orderItems: {
    id: string;
    quantity: number;
    unitPrice: number;
    menuItem: { name: string };
  }[];
  payment: { status: string; amount: number } | null;
};

// ── Status config ─────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; step: number }> = {
  PLACED:    { label: "Order placed",   color: "var(--blue)", bg: "var(--blue-bg)", step: 1 },
  CONFIRMED: { label: "Confirmed",      color: "var(--green)", bg: "var(--green-bg)", step: 2 },
  PREPARING: { label: "Preparing",      color: "var(--amber)", bg: "var(--amber-bg)", step: 3 },
  READY:     { label: "Ready!",         color: "var(--green)", bg: "var(--green-bg)", step: 4 },
  PICKED_UP: { label: "Completed",      color: "var(--text-muted)", bg: "var(--bg-elevated)", step: 5 },
  CANCELLED: { label: "Cancelled",      color: "var(--red)", bg: "var(--red-bg)", step: 0 },
};

const MODE_LABELS: Record<string, string> = {
  TAKEAWAY: "🥡 Takeaway",
  DINE_IN:  "🪑 Dine In",
  DELIVERY: "🛵 Delivery",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ── Main component ─────────────────────────────────────────────
export default function OrdersPage() {
  const router = useRouter();
  const { status } = useSession();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "completed">("all");

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;

    fetch("/api/orders")
      .then((r) => r.json())
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [router, status]);

  if (loading) return (
    <div className="centered-state">
      <div className="spinner" />
      <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Loading your orders...</p>
    </div>
  );

  const filtered = orders.filter((o) => {
    if (activeFilter === "active") return !["PICKED_UP", "CANCELLED"].includes(o.status);
    if (activeFilter === "completed") return ["PICKED_UP", "CANCELLED"].includes(o.status);
    return true;
  });

  const activeCount = orders.filter((o) => !["PICKED_UP", "CANCELLED"].includes(o.status)).length;

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)" }}>

      {/* Header */}
      <div style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "16px 24px 0", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Your Orders
          </h1>
          {activeCount > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, background: "var(--primary)", color: "#fff", padding: "4px 10px", borderRadius: 20 }}>
              {activeCount} active
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "none" }}>
          {(["all", "active", "completed"] as const).map((f) => (
            <button key={f} onClick={() => setActiveFilter(f)} style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 600, background: "none", border: "none",
              borderBottom: activeFilter === f ? "2px solid #9B1B1B" : "2px solid transparent",
              color: activeFilter === f ? "var(--primary)" : "var(--text-secondary)",
              cursor: "pointer", transition: "all 0.15s", textTransform: "capitalize",
            }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 100px" }}>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="centered-state" style={{ minHeight: "50vh" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🧾</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              {activeFilter === "active" ? "No active orders" : activeFilter === "completed" ? "No completed orders yet" : "No orders yet"}
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
              Your orders will appear here once you place one.
            </p>
            <Link href="/browse" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "13px 28px", fontSize: 15, borderRadius: 10, textDecoration: "none" }}>Order now</Link>
          </div>
        )}

        {/* Order cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((order) => {
            const s = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PLACED;
            const isActive = !["PICKED_UP", "CANCELLED"].includes(order.status);

            return (
              <Link key={order.id} href={`/orders/${order.id}`}
                style={{
                  background: "var(--bg-card)", border: isActive ? `1.5px solid ${s.color}30` : "1px solid var(--border)",
                  borderRadius: 16, padding: 0, textAlign: "left",
                  overflow: "hidden", width: "100%", display: "block", textDecoration: "none", color: "inherit",
                  boxShadow: isActive ? `0 2px 12px ${s.color}15` : "0 1px 4px rgba(0,0,0,0.04)",
                  transition: "box-shadow 0.15s",
                }}
              >
                {/* Active order top bar */}
                {isActive && (
                  <div style={{ background: s.bg, padding: "8px 16px", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, display: "inline-block", animation: order.status === "READY" ? "pulse 1s infinite" : "none" }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.label}</span>
                    <span style={{ fontSize: 12, color: s.color, opacity: 0.7, marginLeft: "auto" }}>Tap to track →</span>
                  </div>
                )}

                {/* Card body */}
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{order.vendor.name}</p>
                      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatDate(order.createdAt)}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>₹{(Number(order.totalAmount) + PLATFORM_FEE).toFixed(0)}</p>
                      {!isActive && (
                        <span style={{ fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, padding: "2px 8px", borderRadius: 4 }}>
                          {s.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Items summary */}
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>
                    {order.orderItems.map((i) => `${i.menuItem.name} ×${i.quantity}`).join(", ")}
                  </p>

                  {/* Footer row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--border-lighter)" }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{MODE_LABELS[order.orderMode] ?? order.orderMode}</span>
                    {order.status === "PICKED_UP" && (
                      <span style={{ fontSize: 12, color: "var(--primary)", fontWeight: 600 }}>Reorder →</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
