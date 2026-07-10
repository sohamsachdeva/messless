"use client";

// ============================================================
// app/vendor/menu/page.tsx
// Vendor menu management — add/edit items
// New items go to PENDING_APPROVAL, admin approves to make live
// ============================================================

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  itemType: string;
  isAvailable: boolean;
  approvalStatus: string; // PENDING | APPROVED | REJECTED
  isPopular: boolean;
};

type NewItem = {
  name: string;
  description: string;
  price: string;
  itemType: string;
};

const APPROVAL_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  APPROVED:  { label: "Live",         bg: "var(--green-bg)", color: "var(--green)" },
  PENDING:   { label: "Pending review", bg: "var(--amber-bg)", color: "var(--amber)" },
  REJECTED:  { label: "Rejected",     bg: "var(--red-bg)", color: "var(--red)" },
};

export default function VendorMenuPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newItem, setNewItem] = useState<NewItem>({
    name: "", description: "", price: "", itemType: "VEG",
  });

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;
    fetchItems();
  }, [status, router]);

  async function fetchItems() {
    try {
      const res = await fetch("/api/vendor/menu-items");
      if (!res.ok) throw new Error();
      setItems(await res.json());
    } catch { setItems([]); }
    finally { setLoading(false); }
  }

  async function handleSubmitItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.name || !newItem.price) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/vendor/menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newItem.name.trim(),
          description: newItem.description.trim() || null,
          price: parseFloat(newItem.price),
          itemType: newItem.itemType,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      setSuccessMsg(`"${newItem.name}" submitted for admin approval. It will appear on your menu once approved.`);
      setNewItem({ name: "", description: "", price: "", itemType: "VEG" });
      setShowForm(false);
      fetchItems();
    } catch { setError("Failed to submit item. Please try again."); }
    finally { setSubmitting(false); }
  }

  async function toggleAvailability(itemId: string, current: boolean) {
    await fetch(`/api/vendor/menu-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: !current }),
    });
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, isAvailable: !current } : i));
  }

  if (loading) return (
    <div className="centered-state"><div className="spinner" /></div>
  );

  const approvedItems = items.filter((i) => i.approvalStatus === "APPROVED");
  const pendingItems  = items.filter((i) => i.approvalStatus === "PENDING");
  const rejectedItems = items.filter((i) => i.approvalStatus === "REJECTED");

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)" }}>

      {/* Header */}
      <div style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "16px 24px 20px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Menu Management</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
              {approvedItems.length} live · {pendingItems.length} pending approval
            </p>
          </div>
          <button className="btn-primary" onClick={() => { setShowForm(true); setSuccessMsg(null); }} style={{ padding: "10px 18px", fontSize: 14 }}>
            + Add item
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 20px 60px" }}>

        {/* Success message */}
        {successMsg && (
          <div style={{ background: "var(--green-bg)", border: "1px solid var(--green-border)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <p style={{ fontSize: 13, color: "var(--green)" }}>✅ {successMsg}</p>
            <button onClick={() => setSuccessMsg(null)} style={{ background: "none", border: "none", color: "var(--green)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )}

        {/* Add item form */}
        {showForm && (
          <div style={{ background: "var(--bg-card)", border: "1.5px solid var(--primary)", borderRadius: 16, padding: "20px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Add new menu item</h3>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 20 }}>×</button>
            </div>

            <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--amber)", lineHeight: 1.5 }}>
              ℹ️ New items go to admin for approval before appearing on your menu. Usually approved within a few hours.
            </div>

            <form onSubmit={handleSubmitItem} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Item name *</label>
                  <input className="input" placeholder="e.g. Blueberry Sundae" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} required />
                </div>
                <div>
                  <label style={labelStyle}>Price (₹) *</label>
                  <input className="input" type="number" placeholder="e.g. 120" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} required min="1" step="0.5" />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Description</label>
                <input className="input" placeholder="e.g. Fresh blueberries with vanilla ice cream and waffle cone" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />
              </div>

              <div>
                <label style={labelStyle}>Type</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["VEG", "NON_VEG", "BEVERAGE", "OTHER"].map((type) => (
                    <button key={type} type="button" onClick={() => setNewItem({ ...newItem, itemType: type })}
                      style={{
                        padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: newItem.itemType === type ? "1.5px solid var(--primary)" : "1.5px solid var(--border)",
                        background: newItem.itemType === type ? "var(--primary-bg)" : "var(--bg-card)",
                        color: newItem.itemType === type ? "var(--primary)" : "var(--text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      {type === "VEG" ? "🟢 Veg" : type === "NON_VEG" ? "🔴 Non-Veg" : type === "BEVERAGE" ? "🧃 Beverage" : "📦 Other"}
                    </button>
                  ))}
                </div>
              </div>

              {error && <div style={{ background: "var(--red-bg)", border: "1px solid var(--red-border)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--red)" }}>{error}</div>}

              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: "11px 24px", fontSize: 14 }}>
                  {submitting ? "Submitting..." : "Submit for approval"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline" style={{ padding: "11px 20px", fontSize: 14 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Pending items */}
        {pendingItems.length > 0 && (
          <Section title="⏳ Pending admin approval" items={pendingItems} onToggle={toggleAvailability} showToggle={false} />
        )}

        {/* Live items */}
        {approvedItems.length > 0 && (
          <Section title="✅ Live on menu" items={approvedItems} onToggle={toggleAvailability} showToggle={true} />
        )}

        {/* Rejected items */}
        {rejectedItems.length > 0 && (
          <Section title="❌ Rejected" items={rejectedItems} onToggle={toggleAvailability} showToggle={false} />
        )}

        {/* Empty state */}
        {items.length === 0 && !showForm && (
          <div className="centered-state" style={{ minHeight: "40vh" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🍽️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>No menu items yet</h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>Add your first item and submit it for admin approval.</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add first item</button>
          </div>
        )}
      </div>
    </main>
  );
}

function Section({ title, items, onToggle, showToggle }: {
  title: string;
  items: MenuItem[];
  onToggle: (id: string, current: boolean) => void;
  showToggle: boolean;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 10 }}>{title}</p>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
        {items.map((item, idx) => {
          const badge = APPROVAL_BADGES[item.approvalStatus] ?? APPROVAL_BADGES.PENDING;
          return (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: idx < items.length - 1 ? "1px solid var(--bg-elevated)" : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{item.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: badge.bg, color: badge.color }}>{badge.label}</span>
                  {item.isPopular && <span style={{ fontSize: 10, background: "var(--amber-bg)", color: "var(--amber)", padding: "2px 7px", borderRadius: 4, fontWeight: 700 }}>🔥 Popular</span>}
                </div>
                {item.description && <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>{item.description}</p>}
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>₹{Number(item.price).toFixed(0)}</p>
              </div>

              {/* Availability toggle — only for approved items */}
              {showToggle && item.approvalStatus === "APPROVED" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.isAvailable ? "Available" : "Hidden"}</span>
                  <button
                    onClick={() => onToggle(item.id, item.isAvailable)}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                      background: item.isAvailable ? "var(--primary)" : "var(--border)",
                      position: "relative", transition: "background 0.2s",
                    }}
                  >
                    <span style={{
                      position: "absolute", top: 3, left: item.isAvailable ? 23 : 3,
                      width: 18, height: 18, borderRadius: "50%", background: "var(--bg-card)",
                      transition: "left 0.2s", display: "block",
                    }} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 };
