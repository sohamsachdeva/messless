"use client";

// ============================================================
// app/vendor/orders/page.tsx
// Vendor order management — view orders and update status
// Status progression: PLACED → CONFIRMED → PREPARING → READY → PICKED_UP
// ============================================================

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

// ── Types ─────────────────────────────────────────────────────
type Order = {
  id: string;
  status: string;
  orderMode: string;
  totalAmount: number;
  note: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    phone: string | null;
    thaparId: string | null;
  };
  orderItems: {
    id: string;
    quantity: number;
    unitPrice: number;
    menuItem: { name: string };
  }[];
  payment: {
    status: string;
    amount: number;
    method: string | null;
    paidAt: string | null;
  } | null;
};

// ── Status config ─────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  PLACED:    { label: "Placed",     color: "var(--blue)", bg: "var(--blue-bg)", emoji: "📋" },
  CONFIRMED: { label: "Confirmed",  color: "var(--green)", bg: "var(--green-bg)", emoji: "✅" },
  PREPARING: { label: "Preparing",  color: "var(--amber)", bg: "var(--amber-bg)", emoji: "👨‍🍳" },
  READY:     { label: "Ready",      color: "var(--green)", bg: "var(--green-bg)", emoji: "🎉" },
  PICKED_UP: { label: "Picked Up",  color: "var(--text-muted)", bg: "var(--bg-elevated)", emoji: "✔️" },
  CANCELLED: { label: "Cancelled",  color: "var(--red)", bg: "var(--red-bg)", emoji: "❌" },
};

const STATUS_PROGRESSION = ["PLACED", "CONFIRMED", "PREPARING", "READY", "PICKED_UP"];

const MODE_LABELS: Record<string, string> = {
  TAKEAWAY: "🥡 Takeaway",
  DINE_IN:  "🪑 Dine In",
  DELIVERY: "🛵 Delivery",
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
  const prefix = isToday ? "Today" : isYesterday ? "Yesterday" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${prefix} · ${formatTime(dateStr)}`;
}

// ── Main component ─────────────────────────────────────────────
export default function VendorOrdersPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "completed">("active");
  const [error, setError] = useState<string | null>(null);
  const LIMIT = 20;

  const fetchOrders = useCallback(async (page: number, filter: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vendor/orders?page=${page}&limit=${LIMIT}&filter=${filter}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOrders(data.orders);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setCurrentPage(data.page);
    } catch {
      setOrders([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "unauthenticated") { router.push("/login"); return; }
    if (authStatus !== "authenticated") return;
    if ((session?.user as any)?.role !== "VENDOR") { router.push("/"); return; }
    fetchOrders(1, activeFilter);
  }, [authStatus, router, session, fetchOrders, activeFilter]);

  // Poll every 30 seconds — always check page 1 for new orders
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders(1, activeFilter);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders, activeFilter]);

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    fetchOrders(page, activeFilter);
  }

  function handleFilterChange(filter: "all" | "active" | "completed") {
    setActiveFilter(filter);
    setCurrentPage(1);
  }

  async function handleUpdateStatus(orderId: string, newStatus: string) {
    setUpdatingId(orderId);
    setError(null);

    try {
      const res = await fetch("/api/vendor/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
        return;
      }

      // Optimistically update local state
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } catch {
      setError("Failed to update status. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  function getNextStatus(current: string): string | null {
    const idx = STATUS_PROGRESSION.indexOf(current);
    if (idx === -1 || idx >= STATUS_PROGRESSION.length - 1) return null;
    return STATUS_PROGRESSION[idx + 1];
  }

  // No client-side filtering needed — filtering is done server-side via the API
  const filteredOrders = orders;

  if (loading) return <div className="centered-state"><div className="spinner" /></div>;

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)" }}>

      {/* Header */}
      <div style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "16px 24px 0", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Orders
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {total} total · {activeFilter === "active" ? "active" : activeFilter}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => goToPage(currentPage)}
              disabled={loading}
              style={{ fontSize: 11, color: "var(--primary)", background: "var(--primary-bg)", border: "1px solid var(--primary-border)", padding: "6px 12px", borderRadius: 20, cursor: loading ? "not-allowed" : "pointer", fontWeight: 600, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 0 }}>
          {(["active", "all", "completed"] as const).map((f) => (
            <button key={f} onClick={() => handleFilterChange(f)} style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 600, background: "none", border: "none",
              borderBottom: activeFilter === f ? "2px solid var(--primary)" : "2px solid transparent",
              color: activeFilter === f ? "var(--primary)" : "var(--text-secondary)",
              cursor: "pointer", transition: "all 0.15s", textTransform: "capitalize",
            }}>
              {f === "active" ? `Active` : f === "completed" ? "Completed" : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div style={{ maxWidth: 700, margin: "12px auto 0", padding: "0 20px" }}>
          <div style={{ background: "var(--red-bg)", border: "1px solid var(--red-border)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--red)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 16px 100px" }}>

        {/* Empty state */}
        {filteredOrders.length === 0 && (
          <div className="centered-state" style={{ minHeight: "40vh" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>
              {activeFilter === "active" ? "📭" : "📦"}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              {activeFilter === "active" ? "No active orders" : "No completed orders"}
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
              {activeFilter === "active"
                ? "Orders from students will appear here in real-time."
                : "Completed and cancelled orders will show up here."}
            </p>
            <button onClick={() => router.push("/vendor/dashboard")} className="btn-outline" style={{ padding: "10px 20px" }}>
              ← Back to dashboard
            </button>
          </div>
        )}

        {/* Order cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredOrders.map((order) => {
            const sc = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PLACED;
            const isActive = !["PICKED_UP", "CANCELLED"].includes(order.status);
            const nextStatus = getNextStatus(order.status);

            return (
              <div key={order.id} style={{
                background: "var(--bg-card)",
                border: isActive ? `1.5px solid ${sc.color}30` : "1px solid var(--border)",
                borderRadius: 16, overflow: "hidden",
                boxShadow: isActive ? `0 2px 12px ${sc.color}15` : "0 1px 4px rgba(0,0,0,0.04)",
                transition: "box-shadow 0.15s",
              }}>
                {/* Top bar — status badge + time */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 16px",
                  background: isActive ? `${sc.bg}88` : "var(--bg-page)",
                  borderBottom: "1px solid var(--bg-elevated)",
                }}>
                  <span style={{ fontSize: 16 }}>{sc.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: sc.color }}>{sc.label}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                    {formatDate(order.createdAt)}
                  </span>
                </div>

                {/* Body */}
                <div style={{ padding: "14px 16px" }}>
                  {/* Customer info */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
                        {order.user.name}
                      </p>
                      <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
                        {order.user.thaparId && <span>🆔 {order.user.thaparId}</span>}
                        {order.user.phone && <span>📱 {order.user.phone}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
                        ₹{Number(order.totalAmount).toFixed(0)}
                      </p>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {MODE_LABELS[order.orderMode] ?? order.orderMode}
                      </span>
                    </div>
                  </div>

                  {/* Items */}                    <div style={{ background: "var(--bg-page)", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                    {order.orderItems.map((item, idx) => (
                      <div key={item.id} style={{
                        display: "flex", justifyContent: "space-between",
                        paddingBottom: idx < order.orderItems.length - 1 ? "6px" : 0,
                        marginBottom: idx < order.orderItems.length - 1 ? "6px" : 0,
                        borderBottom: idx < order.orderItems.length - 1 ? "1px solid var(--bg-elevated)" : "none",
                      }}>
                        <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                          {item.menuItem.name} <span style={{ color: "var(--text-muted)" }}>×{item.quantity}</span>
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                          ₹{(Number(item.unitPrice) * item.quantity).toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Note */}
                  {order.note && (
                    <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "var(--amber)" }}>
                      📝 {order.note}
                    </div>
                  )}

                  {/* Payment info */}
                  {order.payment && (
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
                      <span>💳 {order.payment.method ?? "Online"}</span>
                      {order.payment.paidAt && <span>🕐 {formatTime(order.payment.paidAt)}</span>}
                    </div>
                  )}

                  {/* Action buttons */}
                  {isActive && (
                    <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--bg-elevated)" }}>
                      {/* Forward status button */}
                      {nextStatus && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, nextStatus)}
                          disabled={updatingId === order.id}
                          style={{
                            flex: 1, padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                            border: "none", cursor: updatingId === order.id ? "not-allowed" : "pointer",
                            background: sc.color, color: "var(--bg-card)",
                            opacity: updatingId === order.id ? 0.7 : 1,
                            transition: "opacity 0.15s",
                          }}
                        >
                          {updatingId === order.id
                            ? "Updating..."
                            : `Mark as ${STATUS_CONFIG[nextStatus]?.label ?? nextStatus} →`}
                        </button>
                      )}

                      {/* Cancel button — only from PLACED or CONFIRMED */}
                      {["PLACED", "CONFIRMED"].includes(order.status) && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, "CANCELLED")}
                          disabled={updatingId === order.id}
                          style={{
                            padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                            border: "1.5px solid var(--red-bg)", background: "var(--bg-card)",
                            color: "var(--red)", cursor: updatingId === order.id ? "not-allowed" : "pointer",
                            opacity: updatingId === order.id ? 0.7 : 1,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  )}

                  {/* Completed badge */}
                  {order.status === "PICKED_UP" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 10, borderTop: "1px solid var(--bg-elevated)" }}>
                      <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 600 }}>✔️ Completed</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>— order picked up</span>
                    </div>
                  )}
                  {order.status === "CANCELLED" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 10, borderTop: "1px solid var(--bg-elevated)" }}>
                      <span style={{ fontSize: 12, color: "var(--red)", fontWeight: 600 }}>❌ Cancelled</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "24px 16px 32px",
          }}>
            {/* Previous */}
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              style={{
                padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: "1px solid var(--border)", background: currentPage <= 1 ? "var(--bg-page)" : "var(--bg-card)",
                color: currentPage <= 1 ? "#C0C0C0" : "var(--text-primary)",
                cursor: currentPage <= 1 || loading ? "not-allowed" : "pointer",
                opacity: currentPage <= 1 ? 0.5 : 1,
              }}
            >
              ← Prev
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (currentPage <= 4) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = currentPage - 3 + i;
              }
              const isActive = pageNum === currentPage;
              return (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  disabled={loading}
                  style={{
                    width: 36, height: 36, borderRadius: 8, fontSize: 13, fontWeight: 700,
                    border: "none",
                    background: isActive ? "var(--primary)" : "transparent",
                    color: isActive ? "var(--bg-card)" : "var(--text-secondary)",
                    cursor: loading ? "not-allowed" : "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next */}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              style={{
                padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: "1px solid var(--border)", background: currentPage >= totalPages ? "var(--bg-page)" : "var(--bg-card)",
                color: currentPage >= totalPages ? "#C0C0C0" : "var(--text-primary)",
                cursor: currentPage >= totalPages || loading ? "not-allowed" : "pointer",
                opacity: currentPage >= totalPages ? 0.5 : 1,
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
