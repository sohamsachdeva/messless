"use client";

// ============================================================
// app/(student)/cart/page.tsx
// Full cart page
// Shows items, quantities, total, order mode, note to vendor
// Leads to checkout (Razorpay)
// ============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PLATFORM_FEE } from "@/lib/constants";

// ── Types ─────────────────────────────────────────────────────
type CartItem = {
  id: string;
  quantity: number;
  menuItem: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    itemType: string;
    imageUrl: string | null;
    vendor: {
      id: string;
      name: string;
      location: string;
      supportsTakeaway: boolean;
      supportsDineIn: boolean;
      supportsDelivery: boolean;
    };
  };
};

type OrderMode = "DELIVERY" | "DINE_IN" | "TAKEAWAY";

// ── Helpers ───────────────────────────────────────────────────
function getTotal(items: CartItem[]) {
  return items.reduce((sum, i) => sum + Number(i.menuItem.price) * i.quantity, 0);
}

function VegDot({ type }: { type: string }) {
  if (type === "VEG") return (
    <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",width:14,height:14,border:"1.5px solid var(--green)",borderRadius:3,flexShrink:0 }}>
      <span style={{ width:7,height:7,background:"var(--green)",borderRadius:"50%",display:"block" }} />
    </span>
  );
  if (type === "NON_VEG") return (
    <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",width:14,height:14,border:"1.5px solid var(--red)",borderRadius:3,flexShrink:0 }}>
      <span style={{ width:0,height:0,borderLeft:"4px solid transparent",borderRight:"4px solid transparent",borderBottom:"6px solid var(--red)",display:"block" }} />
    </span>
  );
  return null;
}

// ── Main component ─────────────────────────────────────────────
export default function CartPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderMode, setOrderMode] = useState<OrderMode>("TAKEAWAY");
  const [note, setNote] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Read orderMode set by vendor page
  useEffect(() => {
    const saved = sessionStorage.getItem("orderMode") as OrderMode | null;
    if (saved) setOrderMode(saved);
  }, []);

  // Fetch cart
  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;
    fetchCart();
  }, [router, status]);

  async function fetchCart() {
    setLoading(true);
    try {
      const res = await fetch("/api/cart");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCartItems(data);
    } catch {
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  }

  // Update quantity
  async function updateQty(itemId: string, newQty: number) {
    setUpdatingId(itemId);
    try {
      if (newQty === 0) {
        await fetch(`/api/cart/${itemId}`, { method: "DELETE" });
        setCartItems((prev) => prev.filter((i) => i.id !== itemId));
      } else {
        await fetch(`/api/cart/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: newQty }),
        });
        setCartItems((prev) => prev.map((i) => i.id === itemId ? { ...i, quantity: newQty } : i));
      }
    } catch { alert("Failed to update item."); }
    finally { setUpdatingId(null); }
  }

  // Clear cart
  async function clearCart() {
    if (!confirm("Clear your entire cart?")) return;
    await fetch("/api/cart", { method: "DELETE" });
    setCartItems([]);
  }

  // Place order → go to checkout
  async function proceedToCheckout() {
    if (cartItems.length === 0) return;
    if (orderMode === "DELIVERY" && !deliveryLocation.trim()) {
      alert("Please enter your delivery location.");
      return;
    }
    setPlacingOrder(true);
    try {
      const vendor = cartItems[0].menuItem.vendor;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: vendor.id,
          orderMode,
          note: note.trim() || undefined,
          deliveryLocation: orderMode === "DELIVERY" ? deliveryLocation.trim() : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const order = await res.json();
      // Save order ID for checkout page
      sessionStorage.setItem("pendingOrderId", order.id);
      router.push("/checkout");
    } catch {
      alert("Could not place order. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────
  if (loading) return (
    <div className="centered-state">
      <div className="spinner" />
      <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Loading your cart...</p>
    </div>
  );

  // ── Empty cart ─────────────────────────────────────────────
  if (cartItems.length === 0) return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)" }}>
      <div style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "16px 24px" }}>
        <button className="btn-ghost" onClick={() => router.back()} style={{ marginBottom: 8 }}>← Back</button>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Your Cart</h1>
      </div>
      <div className="centered-state" style={{ minHeight: "60vh" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🛒</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Your cart is empty</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>Add items from a shop to get started</p>
        <Link href="/browse" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "13px 28px", fontSize: 15, borderRadius: 10, textDecoration: "none" }}>Browse shops</Link>
      </div>
    </main>
  );

  const vendor = cartItems[0].menuItem.vendor;
  const total = getTotal(cartItems);
  
  const grandTotal = total + PLATFORM_FEE;

  const modes = [
    { key: "TAKEAWAY" as OrderMode, label: "Takeaway", emoji: "🥡" },
    { key: "DINE_IN"  as OrderMode, label: "Dine In",  emoji: "🪑" },
    { key: "DELIVERY" as OrderMode, label: "Delivery", emoji: "🛵" },
  ].filter((m) =>
    (m.key === "TAKEAWAY" && vendor.supportsTakeaway) ||
    (m.key === "DINE_IN"  && vendor.supportsDineIn)   ||
    (m.key === "DELIVERY" && vendor.supportsDelivery)
  );

  // ── Main render ────────────────────────────────────────────
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)" }}>

      {/* ── Header ── */}
      <div style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "16px 24px 20px", position: "sticky", top: 0, zIndex: 40 }}>
        <button className="btn-ghost" onClick={() => router.back()} style={{ marginBottom: 8 }}>← Back</button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 2 }}>Your Cart</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {cartItems.length} item{cartItems.length !== 1 ? "s" : ""} from <span style={{ color: "var(--primary)", fontWeight: 600 }}>{vendor.name}</span>
            </p>
          </div>
          <button onClick={clearCart} style={{ fontSize: 12, color: "var(--red)", background: "var(--red-bg)", border: "none", padding: "5px 12px", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
            Clear cart
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px 140px" }}>

        {/* ── Vendor info chip ── */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🏪</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{vendor.name}</p>
            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>📍 {vendor.location}</p>
          </div>
        </div>

        {/* ── Order mode selector ── */}
        {modes.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <p className="section-label">How do you want your order?</p>
            <div className="mode-tabs">
              {modes.map((m) => (
                <button key={m.key} onClick={() => setOrderMode(m.key)}
                  className={`mode-tab${orderMode === m.key ? " active" : ""}`}>
                  <span style={{ fontSize: 16 }}>{m.emoji}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Delivery location input */}
        {orderMode === "DELIVERY" && (
          <div style={{ marginBottom: 16 }}>
            <label className="section-label">Delivery location</label>
            <input
              className="input"
              placeholder="e.g. Room 204, Block C Hostel"
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
            />
          </div>
        )}

        {/* ── Cart items ── */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Order items</p>
          </div>
          {cartItems.map((item, idx) => (
            <div key={item.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px",
              borderBottom: idx === cartItems.length - 1 ? "none" : "1px solid var(--bg-elevated)",
              opacity: updatingId === item.id ? 0.5 : 1,
              transition: "opacity 0.15s",
            }}>
              {/* Veg dot */}
              <VegDot type={item.menuItem.itemType} />

              {/* Item info */}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{item.menuItem.name}</p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>₹{Number(item.menuItem.price).toFixed(0)} each</p>
              </div>

              {/* Qty controls */}
              <div className="qty-controls">
                <button className="qty-btn" onClick={() => updateQty(item.id, item.quantity - 1)}>−</button>
                <span className="qty-num">{item.quantity}</span>
                <button className="qty-btn" onClick={() => updateQty(item.id, item.quantity + 1)}>+</button>
              </div>

              {/* Item total */}
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", minWidth: 52, textAlign: "right" }}>
                ₹{(Number(item.menuItem.price) * item.quantity).toFixed(0)}
              </p>
            </div>
          ))}
        </div>

        {/* ── Note to vendor ── */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <p className="section-label" style={{ marginBottom: 8 }}>Add a note (optional)</p>
          <textarea
            className="input"
            placeholder="E.g. Less spicy, no onions..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            style={{ resize: "none", fontFamily: "inherit" }}
          />
        </div>

        {/* ── Bill summary ── */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Bill summary</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Item total</span>
              <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>₹{total.toFixed(0)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Platform fee</span>
              <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>₹{PLATFORM_FEE}</span>
            </div>
            {orderMode === "DELIVERY" && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Delivery charge</span>
                <span style={{ fontSize: 13, color: "var(--green)", fontWeight: 600 }}>FREE</span>
              </div>
            )}
            <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>To pay</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>₹{grandTotal.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* ── Cancellation policy ── */}
        <div style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
          <p style={{ fontSize: 12, color: "var(--amber)", fontWeight: 600, marginBottom: 2 }}>Cancellation policy</p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Orders cannot be cancelled once the vendor starts preparing. Please review your order before proceeding.
          </p>
        </div>
      </div>

      {/* ── Sticky checkout bar ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        backgroundColor: "var(--bg-card)",
        borderTop: "1px solid var(--border)",
        padding: "14px 20px",
        zIndex: 100,
        boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}>
              {modes.find((m) => m.key === orderMode)?.emoji} {modes.find((m) => m.key === orderMode)?.label}
            </p>
            <p style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>₹{grandTotal.toFixed(0)}</p>
          </div>
          <button
            className="btn-primary"
            onClick={proceedToCheckout}
            disabled={placingOrder}
            style={{ padding: "13px 28px", fontSize: 15, borderRadius: 10, flex: "0 0 auto" }}
          >
            {placingOrder ? "Processing..." : "Proceed to pay →"}
          </button>
        </div>
      </div>

    </main>
  );
}
