"use client";

import { useEffect, useState, memo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  itemType: "VEG" | "NON_VEG" | "BEVERAGE" | "SNACK" | "OTHER";
  isAvailable: boolean;
  isPopular: boolean;
  imageUrl: string | null;
};

type Vendor = {
  id: string;
  name: string;
  description: string | null;
  location: string;
  category: string;
  openTime: string | null;
  closeTime: string | null;
  rating: number | null;
  phone: string | null;
  supportsDelivery: boolean;
  supportsDineIn: boolean;
  supportsTakeaway: boolean;
  hub: { id: string; name: string };
  menuItems: MenuItem[];
};

type CartMap = Record<string, number>;
type OrderMode = "DELIVERY" | "DINE_IN" | "TAKEAWAY";

const TYPE_LABELS: Record<string, string> = {
  VEG: "🟢 Veg",
  NON_VEG: "🔴 Non-Veg",
  BEVERAGE: "🧃 Beverages",
  SNACK: "🍿 Snacks",
  OTHER: "📦 Other",
};
const TYPE_ORDER = ["VEG", "NON_VEG", "BEVERAGE", "SNACK", "OTHER"];

function isOpenNow(o: string | null, c: string | null) {
  if (!o || !c) return true;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = o.split(":").map(Number);
  const [ch, cm] = c.split(":").map(Number);
  return cur >= oh * 60 + om && cur <= ch * 60 + cm;
}

function fmt(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function totalItems(cart: CartMap) { return Object.values(cart).reduce((s, q) => s + q, 0); }
function totalPrice(cart: CartMap, items: MenuItem[]) {
  return items.reduce((sum, i) => sum + (cart[i.id] ?? 0) * Number(i.price), 0);
}

export default function VendorMenuPage() {
  const router = useRouter();
  const params = useParams();
  const vendorId = (params?.id as string) ?? "";

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartMap>({});
  const [orderMode, setOrderMode] = useState<OrderMode | null>(null);
  const [activeType, setActiveType] = useState("ALL");
  const [goingToCart, setGoingToCart] = useState(false);

  useEffect(() => {
    if (!vendorId) return;
    fetch(`/api/vendors/${vendorId}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        setVendor(data);
        if (data.supportsTakeaway) setOrderMode("TAKEAWAY");
        else if (data.supportsDineIn) setOrderMode("DINE_IN");
        else if (data.supportsDelivery) setOrderMode("DELIVERY");
      })
      .catch(() => setError("Could not load this shop."))
      .finally(() => setLoading(false));
  }, [vendorId]);

  function addItem(id: string) { setCart((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 })); }
  function removeItem(id: string) {
    setCart((p) => {
      const n = { ...p };
      if ((n[id] ?? 0) <= 1) delete n[id]; else n[id]--;
      return n;
    });
  }

  async function goToCart() {
  if (!vendor || totalItems(cart) === 0) return;
  setGoingToCart(true);
  try {
    const deleteRes = await fetch("/api/cart", { method: "DELETE" });
    if (!deleteRes.ok) throw new Error("Failed to clear cart");

    for (const [menuItemId, quantity] of Object.entries(cart)) {
      const addRes = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemId, quantity }),
      });

      if (!addRes.ok) {
        const err = await addRes.json();  // ← get the actual error
        console.error("POST /api/cart failed:", err);
        throw new Error(err.message ?? err.error ?? "Unknown error");
      }
    }

    sessionStorage.setItem("orderMode", orderMode ?? "TAKEAWAY");
    sessionStorage.setItem("vendorId", vendor.id);
    router.push("/cart");
  } catch (err: any) {
    alert("Could not save cart: " + err.message);
  } finally {
    setGoingToCart(false);
  }
}

  if (loading) return <div className="centered-state"><div className="spinner" /><p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Loading menu...</p></div>;
  if (error || !vendor) return <div className="centered-state"><p style={{ color: "var(--red)" }}>{error}</p><button className="btn-ghost" onClick={() => router.back()}>← Go back</button></div>;

  const isOpen = isOpenNow(vendor.openTime, vendor.closeTime);
  const grouped = TYPE_ORDER.reduce<Record<string, MenuItem[]>>((acc, type) => {
    const items = vendor.menuItems.filter((i) => i.itemType === type);
    if (items.length > 0) acc[type] = items;
    return acc;
  }, {});
  const availableTypes = Object.keys(grouped);
  const filteredGroups = activeType === "ALL" ? grouped : { [activeType]: grouped[activeType] ?? [] };

  const cartCount = totalItems(cart);
  const cartTotal = totalPrice(cart, vendor.menuItems);

  const modes = [
    { key: "TAKEAWAY" as OrderMode, label: "Takeaway", emoji: "🥡" },
    { key: "DINE_IN" as OrderMode, label: "Dine In", emoji: "🪑" },
    { key: "DELIVERY" as OrderMode, label: "Delivery", emoji: "🛵" },
  ].filter((m) =>
    (m.key === "TAKEAWAY" && vendor.supportsTakeaway) ||
    (m.key === "DINE_IN" && vendor.supportsDineIn) ||
    (m.key === "DELIVERY" && vendor.supportsDelivery)
  );

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)" }}>

      {/* ── Vendor header ── */}
      <div style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "16px 24px 20px" }}>
        <button className="btn-ghost" onClick={() => router.back()} style={{ marginBottom: 12 }}>← {vendor.hub.name}</button>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>{vendor.name}</h1>
              <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20,
                background: isOpen ? "var(--green-bg)" : "var(--red-bg)", color: isOpen ? "var(--green)" : "var(--red)" }}>
                {isOpen ? "● Open" : "● Closed"}
              </span>
            </div>
            {vendor.description && <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.5 }}>{vendor.description}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="info-chip">📍 {vendor.location}</span>
              {vendor.openTime && vendor.closeTime && <span className="info-chip">🕐 {fmt(vendor.openTime)} – {fmt(vendor.closeTime)}</span>}
              {vendor.rating && vendor.rating > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "var(--green)", color: "#fff", fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>
                  ★ {vendor.rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 20px 120px" }}>

        {/* ── Order mode tabs ── */}
        {isOpen && modes.length > 1 && (
          <div style={{ padding: "16px 0 4px" }}>
            <p className="section-label" style={{ marginBottom: 10 }}>How do you want your order?</p>
            <div className="mode-tabs">
              {modes.map((m) => (
                <button key={m.key} onClick={() => setOrderMode(m.key)}
                  className={`mode-tab${orderMode === m.key ? " active" : ""}`}>
                  <span style={{ fontSize: 18 }}>{m.emoji}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Closed banner ── */}
        {!isOpen && (
          <div className="closed-banner" style={{ marginTop: 16 }}>
            🔴 This shop is currently closed. Check back during opening hours!
          </div>
        )}

        {/* ── Type filter pills ── */}
        {availableTypes.length > 1 && (
          <div className="filter-scroll" style={{ padding: "16px 0 8px" }}>
            <button onClick={() => setActiveType("ALL")} className={`filter-pill${activeType === "ALL" ? " active" : ""}`}>All</button>
            {availableTypes.map((type) => (
              <button key={type} onClick={() => setActiveType(type)} className={`filter-pill${activeType === type ? " active" : ""}`}>
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        )}

        {/* ── Menu sections ── */}
        {Object.entries(filteredGroups).map(([type, items]) => (
          <div key={type} style={{ marginTop: 20 }}>
            <p className="section-label">{TYPE_LABELS[type]}</p>
            {/* White card wrapping items */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
              {items.map((item, idx) => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  quantity={cart[item.id] ?? 0}
                  disabled={!isOpen}
                  onAdd={() => addItem(item.id)}
                  onRemove={() => removeItem(item.id)}
                  isLast={idx === items.length - 1}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Floating cart bar ── */}
      {cartCount > 0 && (
        <div className="cart-bar">
          <div className="cart-bar-inner">
            <div className="cart-bar-left">
              <span className="cart-bar-count">{cartCount} item{cartCount !== 1 ? "s" : ""} · {modes.find((m) => m.key === orderMode)?.emoji} {modes.find((m) => m.key === orderMode)?.label}</span>
              <span className="cart-bar-total">₹{cartTotal}</span>
            </div>
            <button className="cart-bar-btn" onClick={goToCart} disabled={goingToCart}>
              {goingToCart ? "Saving..." : "Go to Cart →"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

const MenuItemRow = memo(function MenuItemRow({ item, quantity, disabled, onAdd, onRemove, isLast }: {
  item: MenuItem; quantity: number; disabled: boolean;
  onAdd: () => void; onRemove: () => void; isLast: boolean;
}) {
  const isVeg = item.itemType === "VEG";
  const isNonVeg = item.itemType === "NON_VEG";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16, padding: "16px 20px",
      borderBottom: isLast ? "none" : "1px solid var(--bg-elevated)",
      opacity: item.isAvailable && !disabled ? 1 : 0.45,
    }}>
      {/* Left: info */}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          {/* Veg/Non-veg dot */}
          {isVeg && (
            <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",width:16,height:16,border:"1.5px solid var(--green)",borderRadius:3,flexShrink:0 }}>
              <span style={{ width:8,height:8,background:"var(--green)",borderRadius:"50%",display:"block" }} />
            </span>
          )}
          {isNonVeg && (
            <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",width:16,height:16,border:"1.5px solid var(--red)",borderRadius:3,flexShrink:0 }}>
              <span style={{ width:0,height:0,borderLeft:"4px solid transparent",borderRight:"4px solid transparent",borderBottom:"7px solid var(--red)",display:"block" }} />
            </span>
          )}
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{item.name}</span>
          {item.isPopular && (
            <span style={{ fontSize: 10, fontWeight: 700, background: "var(--amber-bg)", color: "var(--amber)", padding: "2px 7px", borderRadius: 4 }}>🔥 Popular</span>
          )}
        </div>
        {item.description && <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, lineHeight: 1.4 }}>{item.description}</p>}
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>₹{Number(item.price).toFixed(0)}</span>
      </div>

      {/* Right: add/qty */}
      <div style={{ flexShrink: 0 }}>
        {item.isAvailable && !disabled ? (
          quantity === 0 ? (
            <button className="add-btn" onClick={onAdd}>+ Add</button>
          ) : (
            <div className="qty-controls">
              <button className="qty-btn" onClick={onRemove}>−</button>
              <span className="qty-num">{quantity}</span>
              <button className="qty-btn" onClick={onAdd}>+</button>
            </div>
          )
        ) : (
          <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-page)", padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
            {disabled ? "Closed" : "Unavailable"}
          </span>
        )}
      </div>
    </div>
  );
});
