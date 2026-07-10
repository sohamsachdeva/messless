"use client";

// ============================================================
// app/(student)/orders/[id]/page.tsx
// Live order tracking — polls every 15 seconds for status update
// ============================================================

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { PLATFORM_FEE } from "@/lib/constants";


// ── Types ─────────────────────────────────────────────────────
type Order = {
  id: string;
  status: string;
  orderMode: string;
  totalAmount: number;
  deliveryLocation: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  vendor: { id: string; name: string; location: string; phone: string | null };
  orderItems: {
    id: string;
    quantity: number;
    unitPrice: number;
    menuItem: { name: string; imageUrl: string | null };
  }[];
  payment: { status: string; amount: number; razorpayPaymentId: string | null; paidAt: string | null } | null;
};

// ── Status steps ──────────────────────────────────────────────
const STEPS = [
  { key: "PLACED",    label: "Order Placed",    emoji: "📋", desc: "Your order has been sent to the vendor" },
  { key: "CONFIRMED", label: "Confirmed",        emoji: "✅", desc: "Vendor has accepted your order" },
  { key: "PREPARING", label: "Preparing",        emoji: "👨‍🍳", desc: "Your order is being prepared" },
  { key: "READY",     label: "Ready!",           emoji: "🎉", desc: "Your order is ready for pickup" },
  { key: "PICKED_UP", label: "Picked Up",        emoji: "✔️", desc: "Order complete. Enjoy your meal!" },
];

const MODE_LABELS: Record<string, string> = {
  TAKEAWAY: "🥡 Takeaway",
  DINE_IN:  "🪑 Dine In",
  DELIVERY: "🛵 Delivery",
};

const STATUS_PROGRESSION = ["PLACED", "CONFIRMED", "PREPARING", "READY", "PICKED_UP"];

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Main component ─────────────────────────────────────────────
export default function OrderTrackingPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = (params?.id as string) ?? "";
  const { status } = useSession();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(15);

  const isCompleted = order?.status === "PICKED_UP" || order?.status === "CANCELLED";

  // Fetch order
  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOrder(data);
      setLastRefresh(new Date());
      setCountdown(15);
    } catch {
      // silently fail on background polls
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Initial load
  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;
    fetchOrder();
  }, [router, status, fetchOrder]);

  // Poll every 15 seconds if order is still active
  useEffect(() => {
    if (isCompleted) return;

    const pollInterval = setInterval(fetchOrder, 15000);
    const countdownInterval = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 15 : c - 1));
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(countdownInterval);
    };
  }, [isCompleted, fetchOrder]);
  // ── DEMO MODE: auto-progress order status every 10 seconds ──


useEffect(() => {
  if (process.env.NODE_ENV === "production") return; // only in dev
  if (!order || isCompleted) return;

  const currentIdx = STATUS_PROGRESSION.indexOf(order.status);
  if (currentIdx === -1 || currentIdx === STATUS_PROGRESSION.length - 1) return;

  const timer = setTimeout(async () => {
    const nextStatus = STATUS_PROGRESSION[currentIdx + 1];
    try {
      // Call vendor order status API directly in demo mode
      await fetch(`/api/demo/advance-order/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      await fetchOrder(); // refresh UI
    } catch {}
  }, 10000); // 10 seconds

  return () => clearTimeout(timer);
  }, [fetchOrder, order, orderId, isCompleted]);
  if (loading) return (
    <div className="centered-state">
      <div className="spinner" />
      <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Loading order...</p>
    </div>
  );

  if (!order) return (
    <div className="centered-state">
      <p style={{ color: "var(--red)" }}>Order not found.</p>
      <button className="btn-primary" onClick={() => router.push("/orders")}>My orders</button>
    </div>
  );

  // Find current step index
  const currentStepIdx = order.status === "CANCELLED"
    ? -1
    : STEPS.findIndex((s) => s.key === order.status);

  const grandTotal = Number(order.totalAmount) + PLATFORM_FEE;

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)" }}>

      {/* ── Header ── */}
      <div style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "16px 24px 20px", position: "sticky", top: 0, zIndex: 40 }}>
        <button className="btn-ghost" onClick={() => router.push("/orders")} style={{ marginBottom: 8 }}>← All orders</button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 2 }}>
              {order.vendor.name}
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {formatDate(order.createdAt)} · {formatTime(order.createdAt)} · {MODE_LABELS[order.orderMode]}
            </p>
          </div>
          {!isCompleted && (
            <div style={{ textAlign: "right" }}>
              <button onClick={fetchOrder} style={{ fontSize: 11, color: "var(--primary)", background: "var(--primary-bg)", border: "1px solid var(--primary-border)", padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontWeight: 600 }}>
                Refresh
              </button>
              <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>Auto in {countdown}s</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px 60px" }}>

        {/* ── Status tracker ── */}
        {order.status === "CANCELLED" ? (
          <div style={{ background: "var(--red-bg)", border: "1px solid var(--red-border)", borderRadius: 16, padding: "20px", marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>❌</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--red)" }}>Order Cancelled</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>This order was cancelled.</p>
          </div>
        ) : (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 16px", marginBottom: 16 }}>
            {/* Current status big display */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>{STEPS[currentStepIdx]?.emoji}</div>
              <p style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4 }}>
                {STEPS[currentStepIdx]?.label}
              </p>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{STEPS[currentStepIdx]?.desc}</p>
              {order.status === "READY" && (
                <div style={{ marginTop: 12, background: "var(--green-bg)", border: "1px solid var(--green-border)", borderRadius: 10, padding: "10px 16px" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--green)" }}>
                    🎉 Head to <strong>{order.vendor.name}</strong> — your order is waiting!
                  </p>
                </div>
              )}
            </div>

            {/* Step progress bar */}
            <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
              {STEPS.map((step, idx) => {
                const done = idx <= currentStepIdx;
                const active = idx === currentStepIdx;
                return (
                  <div key={step.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                    {/* Connector line */}
                    {idx < STEPS.length - 1 && (
                      <div style={{
                        position: "absolute", top: 14, left: "50%", width: "100%", height: 3,
                        background: idx < currentStepIdx ? "var(--primary)" : "var(--bg-elevated)",
                        transition: "background 0.4s ease",
                        zIndex: 0,
                      }} />
                    )}
                    {/* Circle */}
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", zIndex: 1,
                      background: done ? "var(--primary)" : "var(--bg-elevated)",
                      border: active ? "3px solid var(--primary)" : "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.3s ease",
                      boxShadow: active ? "0 0 0 4px rgba(155,27,27,0.15)" : "none",
                    }}>
                      {done ? (
                        <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>
                      ) : (
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-muted)", display: "block" }} />
                      )}
                    </div>
                    {/* Label */}
                    <p style={{ fontSize: 9, color: done ? "var(--primary)" : "var(--text-muted)", fontWeight: done ? 700 : 500, marginTop: 6, textAlign: "center", lineHeight: 1.3 }}>
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Delivery info ── */}
        {order.orderMode === "DELIVERY" && order.deliveryLocation && (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Delivery to</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>📦 {order.deliveryLocation}</p>
          </div>
        )}

        {/* ── Note ── */}
        {order.note && (
          <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: 16, padding: "12px 16px", marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--amber)", marginBottom: 2 }}>Your note</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{order.note}</p>
          </div>
        )}

        {/* ── Order items ── */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--bg-elevated)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Order items</p>
          </div>
          {order.orderItems.map((item, idx) => (
            <div key={item.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 16px",
              borderBottom: idx === order.orderItems.length - 1 ? "none" : "1px solid var(--bg-elevated)",
            }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{item.menuItem.name}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>× {item.quantity} · ₹{Number(item.unitPrice).toFixed(0)} each</p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                ₹{(Number(item.unitPrice) * item.quantity).toFixed(0)}
              </p>
            </div>
          ))}
        </div>

        {/* ── Payment summary ── */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Payment</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Item total</span>
              <span style={{ fontSize: 13 }}>₹{Number(order.totalAmount).toFixed(0)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Platform fee</span>
              <span style={{ fontSize: 13 }}>₹{PLATFORM_FEE}</span>
            </div>
            <div style={{ height: 1, background: "var(--border)" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>Total paid</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--primary)" }}>₹{grandTotal.toFixed(0)}</span>
            </div>
            {order.payment?.razorpayPaymentId && (
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Payment ID: {order.payment.razorpayPaymentId}
              </p>
            )}
          </div>
        </div>

        {/* ── Vendor contact ── */}
        {order.vendor.phone && !isCompleted && (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Need help?</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Call the vendor directly</p>
            </div>
            <a href={`tel:${order.vendor.phone}`} style={{
              background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)",
              padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}>
              📞 Call
            </a>
          </div>
        )}

        {/* ── Bottom actions ── */}
        {isCompleted && order.status === "PICKED_UP" && (
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-primary" onClick={() => router.push("/")} style={{ flex: 1, padding: 12 }}>
              Order again
            </button>
            <button className="btn-outline" onClick={() => router.push("/orders")} style={{ flex: 1, padding: 12 }}>
              All orders
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
