"use client";

// ============================================================
// app/(student)/checkout/page.tsx
// Payment page — loads order summary, opens Razorpay modal
// Flow: cart → THIS PAGE → Razorpay modal → success/fail
// ============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PLATFORM_FEE } from "@/lib/constants";

type Order = {
  id: string;
  totalAmount: number;
  orderMode: string;
  deliveryLocation: string | null;
  note: string | null;
  status: string;
  vendor: { id: string; name: string; location: string };
  orderItems: {
    id: string;
    quantity: number;
    unitPrice: number;
    menuItem: { id: string; name: string; imageUrl: string | null };
  }[];
  payment: { status: string } | null;
};

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window.Razorpay !== "undefined") { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const MODE_LABELS: Record<string, string> = {
  TAKEAWAY: "🥡 Takeaway",
  DINE_IN: "🪑 Dine In",
  DELIVERY: "🛵 Delivery",
};

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function CheckoutPage() {
  const router = useRouter();
  const { status } = useSession();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentState, setPaymentState] = useState<"idle" | "success" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<"UPI" | "NetBanking">("UPI"); // ← new state


  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;

    const orderId = sessionStorage.getItem("pendingOrderId");
    if (!orderId) { router.push("/"); return; }

    fetchOrder(orderId);
    loadRazorpayScript();
  }, [router, status]);

  async function fetchOrder(orderId: string) {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOrder(data);
      if (data.payment?.status === "SUCCESS") setPaymentState("success");
    } catch {
      setError("Could not load your order. Please go back and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePayment() {
    if (!order) return;
    setPaymentLoading(true);
    setError(null);

    // 🎯 DEMO MODE: Redirect to fake payment page
    if (DEMO_MODE) {
      // Store order data in sessionStorage for the demo page
      sessionStorage.setItem("demoOrderId", order.id);
      sessionStorage.setItem("demoTotal", String(Number(order.totalAmount) + PLATFORM_FEE));
      sessionStorage.setItem("demoVendor", order.vendor.name);
      sessionStorage.setItem("demoPaymentMethod", selectedMethod);
      router.push("/demo-payment");
      setPaymentLoading(false);
      return;
    }

    // ── REAL RAZORPAY FLOW ──
    try {
      const res = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });

      if (!res.ok) throw new Error("Could not initiate payment.");
      const { razorpayOrderId, amount, currency, keyId, vendorName, studentName, studentEmail } = await res.json();

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error("Payment gateway failed to load.");

      const rzp = new window.Razorpay({
        key: keyId,
        amount,
        currency,
        name: "MessLess",
        description: `Order from ${vendorName}`,
        order_id: razorpayOrderId,
        prefill: {
          name: studentName,
          email: studentEmail,
        },
        theme: { color: "var(--primary)" },
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch("/api/razorpay/webhook", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            if (!verifyRes.ok) throw new Error("Payment verification failed.");
            sessionStorage.removeItem("pendingOrderId");
            setPaymentState("success");
          } catch {
            setError("Payment went through but verification failed. Please contact support with your payment ID: " + response.razorpay_payment_id);
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentLoading(false);
            setError("Payment cancelled. You can try again.");
          },
        },
      });

      rzp.on("payment.failed", function (response: any) {
        setPaymentState("failed");
        setError(`Payment failed: ${response.error.description}`);
        setPaymentLoading(false);
      });

      rzp.open();
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setPaymentLoading(false);
    }
  }

  if (loading) return (
    <div className="centered-state">
      <div className="spinner" />
      <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Loading checkout...</p>
    </div>
  );

  if (error && !order) return (
    <div className="centered-state">
      <p style={{ color: "var(--red)", fontSize: 14 }}>{error}</p>
      <button className="btn-primary" onClick={() => router.push("/")}>Go home</button>
    </div>
  );

  if (paymentState === "success") return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "40px 32px", maxWidth: 420, width: "100%", margin: "0 20px", textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.08)" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--green-bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 36 }}>
          ✅
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.02em" }}>Order placed!</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
          Your order at <strong>{order?.vendor.name}</strong> is confirmed.
        </p>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 28 }}>
          {order?.orderMode === "DELIVERY"
            ? "Your order will be delivered to you shortly."
            : order?.orderMode === "DINE_IN"
            ? "Please find your seat — your order is being prepared."
            : "We'll notify you when your order is ready for pickup."}
        </p>
        <div style={{ background: "var(--bg-page)", borderRadius: 12, padding: "14px 16px", marginBottom: 24, textAlign: "left" }}>
          {order?.orderItems.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-primary)", padding: "4px 0" }}>
              <span>{item.menuItem.name} × {item.quantity}</span>
              <span style={{ fontWeight: 600 }}>₹{(Number(item.unitPrice) * item.quantity).toFixed(0)}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 14 }}>
            <span>Total paid</span>
            <span style={{ color: "var(--primary)" }}>₹{(Number(order?.totalAmount ?? 0) + PLATFORM_FEE).toFixed(0)}</span>
          </div>
        </div>
        <button className="btn-primary" onClick={() => router.push("/orders")} style={{ width: "100%", padding: 13, fontSize: 15, marginBottom: 10 }}>
          Track my order →
        </button>
        <button className="btn-ghost" onClick={() => router.push("/")} style={{ width: "100%", textAlign: "center", justifyContent: "center" }}>
          Order something else
        </button>
      </div>
    </main>
  );

  if (paymentState === "failed") return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "40px 32px", maxWidth: 420, width: "100%", margin: "0 20px", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>❌</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>Payment failed</h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24 }}>{error}</p>
        <button className="btn-primary" onClick={() => { setPaymentState("idle"); setError(null); }} style={{ width: "100%", marginBottom: 10 }}>
          Try again
        </button>
        <button className="btn-ghost" onClick={() => router.push("/cart")} style={{ width: "100%", textAlign: "center", justifyContent: "center" }}>
          ← Back to cart
        </button>
      </div>
    </main>
  );

  if (!order) return null;

  const grandTotal = Number(order.totalAmount) + PLATFORM_FEE;

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)" }}>
      <div style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border)", padding: "16px 24px 20px", position: "sticky", top: 0, zIndex: 40 }}>
        <button className="btn-ghost" onClick={() => router.back()} style={{ marginBottom: 8 }}>← Back to cart</button>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Checkout</h1>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px 140px" }}>
        {/* Vendor + order mode */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{order.vendor.name}</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>📍 {order.vendor.location}</p>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)", background: "var(--primary-bg)", padding: "5px 12px", borderRadius: 20, border: "1px solid var(--red-border)" }}>
              {MODE_LABELS[order.orderMode]}
            </span>
          </div>
          {order.deliveryLocation && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", background: "var(--bg-page)", padding: "8px 12px", borderRadius: 8 }}>
              📦 Deliver to: <strong>{order.deliveryLocation}</strong>
            </p>
          )}
          {order.note && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", background: "var(--bg-page)", padding: "8px 12px", borderRadius: 8, marginTop: 8 }}>
              📝 Note: {order.note}
            </p>
          )}
        </div>

        {/* Order items */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Order summary</p>
          </div>
          {order.orderItems.map((item, idx) => (
            <div key={item.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 16px",
              borderBottom: idx === order.orderItems.length - 1 ? "none" : "1px solid var(--bg-elevated)",
            }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{item.menuItem.name}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>× {item.quantity}</p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                ₹{(Number(item.unitPrice) * item.quantity).toFixed(0)}
              </p>
            </div>
          ))}
        </div>

        {/* Bill breakdown */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Payment details</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Item total</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>₹{Number(order.totalAmount).toFixed(0)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Platform fee</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>₹{PLATFORM_FEE}</span>
            </div>
            {order.orderMode === "DELIVERY" && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Delivery charge</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--green)" }}>FREE</span>
              </div>
            )}
            <div style={{ height: 1, background: "var(--border)" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Grand total</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>₹{grandTotal.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* ─── UPDATED: Clickable Payment Method Buttons ─── */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Select payment method</p>
          <div style={{ display: "flex", gap: 12 }}>
            {/* UPI Button */}
            <button
              onClick={() => setSelectedMethod("UPI")}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 0",
                borderRadius: 12,
                border: `2px solid ${selectedMethod === "UPI" ? "var(--primary)" : "var(--border)"}`,
                background: selectedMethod === "UPI" ? "var(--primary-bg)" : "var(--bg-card)",
                fontSize: 14,
                fontWeight: 600,
                color: selectedMethod === "UPI" ? "var(--primary)" : "var(--text-primary)",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: selectedMethod === "UPI" ? "0 0 0 2px color-mix(in srgb, var(--primary) 10%, transparent)" : "none",
              }}
              onMouseEnter={(e) => {
                if (selectedMethod !== "UPI") {
                  e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary) 25%, transparent)";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedMethod !== "UPI") {
                  e.currentTarget.style.borderColor = "var(--border)";
                }
              }}
            >
              <span style={{ fontSize: 18 }}>📱</span>
              UPI
              {selectedMethod === "UPI" && (
                <span style={{ marginLeft: 4, fontSize: 16 }}>✅</span>
              )}
            </button>

            {/* NetBanking Button */}
            <button
              onClick={() => setSelectedMethod("NetBanking")}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 0",
                borderRadius: 12,
                border: `2px solid ${selectedMethod === "NetBanking" ? "var(--primary)" : "var(--border)"}`,
                background: selectedMethod === "NetBanking" ? "var(--primary-bg)" : "var(--bg-card)",
                fontSize: 14,
                fontWeight: 600,
                color: selectedMethod === "NetBanking" ? "var(--primary)" : "var(--text-primary)",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: selectedMethod === "NetBanking" ? "0 0 0 2px color-mix(in srgb, var(--primary) 10%, transparent)" : "none",
              }}
              onMouseEnter={(e) => {
                if (selectedMethod !== "NetBanking") {
                  e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary) 25%, transparent)";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedMethod !== "NetBanking") {
                  e.currentTarget.style.borderColor = "var(--border)";
                }
              }}
            >
              <span style={{ fontSize: 18 }}>🏦</span>
              NetBanking
              {selectedMethod === "NetBanking" && (
                <span style={{ marginLeft: 4, fontSize: 16 }}>✅</span>
              )}
            </button>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, textAlign: "center" }}>
            {DEMO_MODE ? "🔬 Demo mode — you'll be redirected to a test payment page" : "You'll be redirected to Razorpay to complete payment"}
          </p>
        </div>

        {/* Safety note */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: "var(--green-bg)", border: "1px solid var(--green-border)", borderRadius: 12 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
          <p style={{ fontSize: 12, color: "var(--green)", lineHeight: 1.5 }}>
            Your payment is 100% secure. Processed by Razorpay — PCI DSS compliant.
          </p>
        </div>

        {error && (
          <div style={{ background: "var(--red-bg)", border: "1px solid var(--red-border)", borderRadius: 10, padding: "12px 14px", marginTop: 16 }}>
            <p style={{ fontSize: 13, color: "var(--red)" }}>{error}</p>
          </div>
        )}
      </div>

      {/* Sticky pay button */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        backgroundColor: "var(--bg-card)",
        borderTop: "1px solid var(--border)",
        padding: "14px 20px",
        zIndex: 100,
        boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <button
            className="btn-primary"
            onClick={handlePayment}
            disabled={paymentLoading}
            style={{ width: "100%", padding: "15px", fontSize: 16, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {paymentLoading ? (
              <>
                <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.4)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                Opening payment...
              </>
            ) : (
              <>💳 Pay ₹{grandTotal.toFixed(0)} via {selectedMethod}</>
            )}
          </button>
          <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 8 }}>
            By paying you agree to MessLess terms of service
          </p>
        </div>
      </div>
    </main>
  );
}