"use client";
// app/admin/menu-items/page.tsx — approve/reject vendor menu item submissions

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type Item = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  itemType: string;
  approvalStatus: string;
  createdAt: string;
  adminNote: string | null;
  vendor: { id: string; name: string };
};

const TYPE_DOTS: Record<string, string> = {
  VEG: "🟢", NON_VEG: "🔴", BEVERAGE: "🧃", OTHER: "📦",
};

export default function AdminMenuItemsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [showNoteFor, setShowNoteFor] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;
    if ((session?.user as any)?.role !== "ADMIN") { router.push("/"); return; }
    fetchItems();
  }, [status, session, router]);

  async function fetchItems() {
    const res = await fetch("/api/admin/menu-items");
    setItems(await res.json());
    setLoading(false);
  }

  async function handleAction(itemId: string, action: "approve" | "reject") {
    setActionId(itemId);
    await fetch(`/api/admin/menu-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, adminNote: rejectNote[itemId] || null }),
    });
    setShowNoteFor(null);
    await fetchItems();
    setActionId(null);
  }

  const filtered = items.filter(i => i.approvalStatus === filter);
  const pendingCount = items.filter(i => i.approvalStatus === "PENDING").length;

  if (loading) return <div className="centered-state"><div className="spinner" /></div>;

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)" }}>
      <div style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "16px 24px 0", position: "sticky", top: 60, zIndex: 30 }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ marginBottom: 16 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>Menu Item Approvals</h1>
            {pendingCount > 0 && <p style={{ fontSize: 13, color: "var(--blue)", fontWeight: 600, marginTop: 2 }}>{pendingCount} items waiting for review</p>}
          </div>
          <div style={{ display: "flex", gap: 0 }}>
            {(["PENDING", "APPROVED", "REJECTED"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "8px 16px", fontSize: 13, fontWeight: 600, background: "none", border: "none",
                borderBottom: filter === f ? "2.5px solid var(--primary)" : "2.5px solid transparent",
                color: filter === f ? "var(--primary)" : "var(--text-secondary)", cursor: "pointer",
              }}>
                {f.charAt(0) + f.slice(1).toLowerCase()}
                {f === "PENDING" && pendingCount > 0 ? ` (${pendingCount})` : ""}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 20px 60px" }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontSize: 32, marginBottom: 12 }}>✅</p>
            <p>No {filter.toLowerCase()} items</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(item => (
              <div key={item.id} style={{ background: "var(--bg-card)", border: item.approvalStatus === "PENDING" ? "1.5px solid var(--blue-border)" : "1px solid var(--border)", borderRadius: 16, padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>{TYPE_DOTS[item.itemType] ?? "📦"}</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{item.name}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "var(--primary)" }}>₹{Number(item.price).toFixed(0)}</span>
                    </div>

                    {item.description && <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>{item.description}</p>}

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="info-chip">🏪 {item.vendor.name}</span>
                      <span className="info-chip">📅 {new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    </div>

                    {item.adminNote && (
                      <div style={{ marginTop: 8, background: "var(--red-bg)", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "var(--red)" }}>
                        Rejection note: {item.adminNote}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {item.approvalStatus === "PENDING" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => handleAction(item.id, "approve")} disabled={actionId === item.id} className="btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>
                          {actionId === item.id ? "..." : "✅ Approve"}
                        </button>
                        <button onClick={() => setShowNoteFor(showNoteFor === item.id ? null : item.id)} style={{ padding: "8px 14px", fontSize: 13, fontWeight: 600, background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-border)", borderRadius: 8, cursor: "pointer" }}>
                          ❌ Reject
                        </button>
                      </div>

                      {/* Reject with note */}
                      {showNoteFor === item.id && (
                        <div style={{ display: "flex", gap: 8, width: "100%" }}>
                          <input
                            className="input"
                            placeholder="Reason for rejection (optional)"
                            value={rejectNote[item.id] ?? ""}
                            onChange={(e) => setRejectNote(prev => ({ ...prev, [item.id]: e.target.value }))}
                            style={{ fontSize: 12, flex: 1 }}
                          />
                          <button onClick={() => handleAction(item.id, "reject")} disabled={actionId === item.id} style={{ padding: "8px 14px", fontSize: 12, fontWeight: 600, background: "var(--red)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" as const }}>
                            Confirm reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
