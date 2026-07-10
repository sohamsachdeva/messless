"use client";
// app/admin/analytics/page.tsx

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type AnalyticsData = {
  summary: {
    totalRevenue: number;
    todayRevenue: number;
    totalOrders: number;
    totalStudents: number;
    totalVendors: number;
    pendingVendors: number;
  };
  dailySeries: { date: string; orders: number; revenue: number; newUsers: number }[];
  statusDistribution: { status: string; count: number }[];
  topVendors: { id: string; name: string; hubName: string; totalOrders: number; menuItemCount: number; revenue: number }[];
  popularItems: { id: string; name: string; price: number; itemType: string; vendorName: string; totalOrdered: number }[];
  hubPerformance: { id: string; name: string; vendorCount: number; totalOrders: number; totalRevenue: number }[];
  peakHours: { hour: number; count: number }[];
};

const STATUS_COLORS: Record<string, string> = {
  PLACED: "var(--blue)",
  CONFIRMED: "var(--green)",
  PREPARING: "var(--amber)",
  READY: "var(--green)",
  PICKED_UP: "var(--text-secondary)",
  CANCELLED: "var(--red)",
};

const TYPE_EMOJIS: Record<string, string> = {
  VEG: "🟢", NON_VEG: "🔴", BEVERAGE: "🧃", SNACK: "🍿", OTHER: "📦",
};

const STATUS_LABELS: Record<string, string> = {
  PLACED: "Placed",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  PICKED_UP: "Picked up",
  CANCELLED: "Cancelled",
};

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function fmtCurrency(n: number) {
  return n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : n >= 1000
      ? `₹${(n / 1000).toFixed(1)}K`
      : `₹${n.toLocaleString("en-IN")}`;
}

function BarChart({
  data,
  valueKey,
  labelKey,
  color,
  height = 140,
  showLabels = true,
  format = "number",
}: {
  data: any[];
  valueKey: string;
  labelKey: string;
  color: string;
  height?: number;
  showLabels?: boolean;
  format?: "number" | "currency";
}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height, paddingTop: 8 }}>
      {data.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const pct = (val / max) * 100;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
            {val > 0 && (
              <span style={{ fontSize: 9, color: "var(--text-secondary)", marginBottom: 2, fontWeight: 600 }}>
                {format === "currency" ? fmtCurrency(val) : val}
              </span>
            )}
            <div
              title={`${d[labelKey]}: ${val}`}
              style={{
                width: "100%",
                maxWidth: 40,
                height: `${Math.max(pct, 2)}%`,
                background: color,
                borderRadius: "4px 4px 0 0",
                opacity: 0.85,
                transition: "height 0.3s",
                minHeight: val > 0 ? 4 : 0,
              }}
            />
            {showLabels && (
              <span style={{ fontSize: 8, color: "var(--text-muted)", marginTop: 4, whiteSpace: "nowrap", transform: "rotate(-45deg)", transformOrigin: "left" }}>
                {d[labelKey]?.length > 5 ? d[labelKey].slice(0, 5) : d[labelKey]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── CSV Export helpers ────────────────────────────────

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function CSVExportBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      title={`Download ${label} as CSV`}
      style={{
        padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "1px solid var(--border)",
        background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 4,
      }}
    >
      ⬇ CSV
    </button>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ flex: 1, height: 8, background: "var(--bg-elevated)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.3s" }} />
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"revenue" | "orders">("revenue");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;
    if ((session?.user as any)?.role !== "ADMIN") { router.push("/"); return; }

    async function load() {
      try {
        const r = await fetch("/api/admin/analytics");
        if (!r.ok) throw new Error("Failed to load");
        setData(await r.json());
        setLastRefreshed(new Date());
        setError(null);
      } catch (e) {
        setError(String(e));
      }
    }

    load().finally(() => {
      setLoading(false);
      setRefreshing(false);
    });

    // Auto-poll every 60 seconds
    const interval = setInterval(() => {
      setRefreshTrigger(t => t + 1);
    }, 60_000);
    return () => clearInterval(interval);
  }, [status, session, router, refreshTrigger]);

  function handleRefresh() {
    setRefreshing(true);
    setRefreshTrigger(t => t + 1);
  }

  if (loading) return <div className="centered-state"><div className="spinner" /></div>;
  if (error || !data) {
    return (
      <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>📉</p>
          <p style={{ color: "var(--text-secondary)" }}>Could not load analytics. Try again later.</p>
        </div>
      </main>
    );
  }

  const { summary, dailySeries, statusDistribution, topVendors, popularItems, hubPerformance, peakHours } = data;
  const maxOrders = Math.max(...dailySeries.map((d) => d.orders), 1);
  const maxRevenue = Math.max(...dailySeries.map((d) => d.revenue), 1);
  const maxPeak = Math.max(...peakHours.map((h) => h.count), 1);
  const totalStatusCount = statusDistribution.reduce((s, sd) => s + sd.count, 0);

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, var(--hero-bg) 0%, #000000 100%)", padding: "32px 24px 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: 13, color: "var(--hero-text-muted)", marginBottom: 4 }}>Admin panel</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--hero-text)", letterSpacing: "-0.03em" }}>Analytics</h1>
          <p style={{ fontSize: 14, color: "var(--hero-text-muted)", marginTop: 4 }}>
            {summary.totalOrders} orders · {summary.totalStudents} students · {summary.totalVendors} vendors
          </p>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                padding: "8px 16px", fontSize: 12, fontWeight: 600, borderRadius: 8, border: "1px solid var(--hero-text-muted)",
                background: "rgba(255,255,255,0.08)", color: "var(--hero-text)", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span style={{ display: "inline-block", transform: refreshing ? "rotate(360deg)" : "rotate(0deg)", transition: "transform 0.6s" }}>⟳</span>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <span style={{ fontSize: 11, color: "var(--hero-text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
              Auto-refreshes every 60s
            </span>
            {lastRefreshed && (
              <span style={{ fontSize: 11, color: "var(--hero-text-muted)" }}>
                · Last updated {lastRefreshed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "-20px auto 0", padding: "0 20px 60px" }}>
        {/* ───── Summary Cards ───── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Total revenue", value: fmtCurrency(summary.totalRevenue), sub: `Today: ${fmtCurrency(summary.todayRevenue)}`, emoji: "💰", color: "var(--green)" },
            { label: "Total orders", value: summary.totalOrders.toLocaleString("en-IN"), sub: `${dailySeries.reduce((s, d) => s + d.orders, 0)} in 30d`, emoji: "📦", color: "var(--blue)" },
            { label: "Students", value: summary.totalStudents.toLocaleString("en-IN"), sub: `${dailySeries.reduce((s, d) => s + d.newUsers, 0)} new in 30d`, emoji: "🎓", color: "var(--text-secondary)" },
            { label: "Vendors", value: summary.totalVendors.toLocaleString("en-IN"), sub: `${summary.pendingVendors} pending approval`, emoji: "🏪", color: "var(--amber)" },
          ].map((card) => (
            <div key={card.label} style={{    background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px" }}>
              <span style={{ fontSize: 24 }}>{card.emoji}</span>
              <p style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: "6px 0 2px", letterSpacing: "-0.02em" }}>{card.value}</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{card.label}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{card.sub}</p>
            </div>
          ))}
        </div>

        {/* ───── Revenue & Orders Chart ───── */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Last 30 Days</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <CSVExportBtn
                label="Revenue"
                onClick={() => downloadCSV("messless-revenue-30d.csv",
                  ["Date", "Orders", "Revenue (₹)", "New Users"],
                  dailySeries.map(d => [d.date, String(d.orders), String(d.revenue), String(d.newUsers)])
                )}
              />
              <div style={{ display: "flex", gap: 4, background: "var(--bg-elevated)", borderRadius: 8, padding: 2 }}>
                {(["revenue", "orders"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: "6px 14px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "none", cursor: "pointer",
                      background: activeTab === tab ? "var(--bg-card)" : "transparent",
                      color: activeTab === tab ? "var(--text-primary)" : "var(--text-secondary)",
                      boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    {tab === "revenue" ? "💰 Revenue" : "📦 Orders"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {activeTab === "revenue" ? (
            <>
              <BarChart data={dailySeries} valueKey="revenue" labelKey="date" color="var(--green)" height={160} format="currency" showLabels={false} />
              <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-muted)" }}>
                <span>{fmtDate(dailySeries[0]?.date ?? "")}</span>
                <span>{fmtDate(dailySeries[Math.floor(dailySeries.length / 2)]?.date ?? "")}</span>
                <span>{fmtDate(dailySeries[dailySeries.length - 1]?.date ?? "")}</span>
              </div>
            </>
          ) : (
            <>
              <BarChart data={dailySeries} valueKey="orders" labelKey="date" color="var(--blue)" height={160} showLabels={false} />
              <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-muted)" }}>
                <span>{fmtDate(dailySeries[0]?.date ?? "")}</span>
                <span>{fmtDate(dailySeries[Math.floor(dailySeries.length / 2)]?.date ?? "")}</span>
                <span>{fmtDate(dailySeries[dailySeries.length - 1]?.date ?? "")}</span>
              </div>
            </>
          )}

          {/* Mini legend */}
          <div style={{ marginTop: 16, display: "flex", gap: 20, fontSize: 12, color: "var(--text-secondary)" }}>
            <span><span style={{ color: "var(--green)", fontWeight: 700 }}>█</span> 30d revenue: {fmtCurrency(dailySeries.reduce((s, d) => s + d.revenue, 0))}</span>
            <span><span style={{ color: "var(--blue)", fontWeight: 700 }}>█</span> 30d orders: {dailySeries.reduce((s, d) => s + d.orders, 0)}</span>
          </div>
        </div>

        {/* ───── Two-column layout ───── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          {/* Status distribution */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Order Status Distribution</h2>
            {statusDistribution.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No orders yet</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {statusDistribution.map((sd) => {
                  const pct = totalStatusCount > 0 ? (sd.count / totalStatusCount) * 100 : 0;
                  return (
                    <div key={sd.status}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{STATUS_LABELS[sd.status] ?? sd.status}</span>
                        <span style={{ color: "var(--text-secondary)" }}>{sd.count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <MiniBar value={sd.count} max={totalStatusCount} color={STATUS_COLORS[sd.status] ?? "var(--text-secondary)"} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Peak hours */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Peak Ordering Hours</h2>
            {peakHours.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No orders yet</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {peakHours.map((ph) => {
                  const period = ph.hour < 12 ? "AM" : "PM";
                  const h12 = ph.hour === 0 ? 12 : ph.hour > 12 ? ph.hour - 12 : ph.hour;
                  return (
                    <div key={ph.hour} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", width: 48, textAlign: "right" }}>{h12}{period}</span>
                      <MiniBar value={ph.count} max={maxPeak} color="var(--amber)" />
                      <span style={{ fontSize: 11, color: "var(--text-muted)", width: 30 }}>{ph.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ───── Hub Performance ───── */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px", marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Hub Performance</h2>
          {hubPerformance.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No hubs configured</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
              {hubPerformance.map((hub) => (
                <div key={hub.id} style={{ background: "var(--bg-page)", borderRadius: 12, padding: "14px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>🏪 {hub.name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{hub.vendorCount} vendors</span>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <div>
                      <p style={{ fontSize: 18, fontWeight: 800, color: "var(--blue)" }}>{hub.totalOrders}</p>
                      <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Orders</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 18, fontWeight: 800, color: "var(--green)" }}>{fmtCurrency(hub.totalRevenue)}</p>
                      <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Revenue</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ───── Top Vendors + Popular Items ───── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          {/* Top vendors */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Top Vendors by Revenue</h2>
              <CSVExportBtn
                label="Vendors"
                onClick={() => downloadCSV("messless-top-vendors.csv",
                  ["#", "Vendor", "Hub", "Total Orders", "Menu Items", "Revenue (₹)"],
                  topVendors.map((v, i) => [String(i + 1), v.name, v.hubName, String(v.totalOrders), String(v.menuItemCount), String(v.revenue)])
                )}
              />
            </div>
            {topVendors.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No vendors yet</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topVendors.map((v, idx) => (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", width: 20 }}>#{idx + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{v.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>{fmtCurrency(v.revenue)}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--text-muted)" }}>
                        <span>{v.hubName}</span>
                        <span>·</span>
                        <span>{v.totalOrders} orders</span>
                        <span>·</span>
                        <span>{v.menuItemCount} items</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Popular items */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Most Ordered Items</h2>
              <CSVExportBtn
                label="Items"
                onClick={() => downloadCSV("messless-popular-items.csv",
                  ["#", "Item", "Type", "Vendor", "Price (₹)", "Times Ordered"],
                  popularItems.map((item, i) => [String(i + 1), item.name, item.itemType, item.vendorName, String(item.price), String(item.totalOrdered)])
                )}
              />
            </div>
            {popularItems.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No items ordered yet</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {popularItems.map((item, idx) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", width: 20 }}>#{idx + 1}</span>
                    <span style={{ fontSize: 16 }}>{TYPE_EMOJIS[item.itemType] ?? "📦"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{item.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--amber)" }}>×{item.totalOrdered}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {item.vendorName} · ₹{item.price}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ───── User Growth ───── */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Student Registrations (Last 30 Days)</h2>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Total: {dailySeries.reduce((s, d) => s + d.newUsers, 0)} new
            </span>
          </div>
          <BarChart data={dailySeries} valueKey="newUsers" labelKey="date" color="var(--primary)" height={100} showLabels={false} />
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-muted)" }}>
            <span>{fmtDate(dailySeries[0]?.date ?? "")}</span>
            <span>{fmtDate(dailySeries[dailySeries.length - 1]?.date ?? "")}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
