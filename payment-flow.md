# 💳 MessLess — Payment Integration Deep Dive

> Full-Stack Campus Food Ordering Platform | Thapar Institute of Engineering & Technology

---

## Table of Contents

- [The 6-Step Flow Overview](#the-6-step-flow-overview)
- [Step 1: Order Creation (POST /api/orders)](#step-1-order-creation)
- [Step 2: Checkout Page (/checkout)](#step-2-checkout-page)
- [Step 3: Create Razorpay Order (POST /api/razorpay/create-order)](#step-3-create-razorpay-order)
- [Step 4: Razorpay Checkout Modal (Client-Side)](#step-4-razorpay-checkout-modal)
- [Step 5: Webhook Verification (POST /api/razorpay/webhook)](#step-5-webhook-verification)
- [Step 6: Success UI](#step-6-success-ui)
- [Why This Is Technically Challenging](#why-this-is-technically-challenging)
- [Security Layers Summary](#security-layers-summary)
- [The Flow Diagram](#the-flow-diagram)
- [Interview Answer — 30-Second Summary](#interview-answer--30-second-summary)

---

## The 6-Step Flow Overview

```
Cart Page
  │
  ▼
Step 1: POST /api/orders
  │  Creates Order in DB (Prisma $transaction: creates order + clears cart atomically)
  │  Order starts with status: PLACED
  ▼
Step 2: /checkout page
  │  Loads order summary from DB
  │  Shows bill breakdown (item total + ₹5 platform fee)
  │  User selects payment method (UPI / NetBanking)
  │  Sticky "Pay" button at bottom
  ▼
Step 3: POST /api/razorpay/create-order
  │  Checks: authentication, order ownership, order exists
  │  Creates Razorpay order via Razorpay's server-side SDK
  │  Saves Payment record (status: PENDING)
  │  Returns: razorpayOrderId, amount, keyId, etc.
  ▼
Step 4: Razorpay Checkout Modal
  │  Dynamically loads checkout.js script
  │  Opens Razorpay modal with pre-filled user details
  │  3 possible outcomes:
  │
  ├── SUCCESS → Step 5 (webhook fires server-to-server)
  ├── FAILED  → Error UI with retry button
  └── DISMISS → "Payment cancelled, you can try again"
  │
  ▼
Step 5: POST /api/razorpay/webhook
  │  Validates required fields
  │  HMAC-SHA256 signature verification (prevents fake webhooks)
  │  Finds Payment record by razorpay_order_id
  │  Prisma $transaction:
  │    → Payment: SUCCESS (saves payment ID, signature, timestamp)
  │    → Order: CONFIRMED (moves from PLACED → CONFIRMED)
  │  If either fails, BOTH roll back
  ▼
Step 6: Success Page
  │  "Order placed! ✅"
  │  Order summary with items and total
  │  Contextual message based on order mode
  │  "Track my order →" button
```

---

## Step 1: Order Creation

**File:** `app/api/orders/route.ts`

Before any payment happens, the student's cart is converted into an Order. This uses a **Prisma `$transaction`** to ensure atomicity.

```typescript
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { vendorId, orderMode, note, deliveryLocation } = body;

  if (!vendorId || !orderMode) {
    return NextResponse.json({ error: "vendorId and orderMode are required" }, { status: 400 });
  }

  // Fetch current cart items with menu item details
  const cartItems = await prisma.cartItem.findMany({
    where: { userId: session.user.id },
    include: { menuItem: true },
  });

  if (cartItems.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // Calculate total
  const totalAmount = cartItems.reduce(
    (sum, item) => sum + Number(item.menuItem.price) * item.quantity,
    0
  );

  // Atomic transaction: create order + items + clear cart
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        userId: session.user.id,
        vendorId,
        totalAmount,
        orderMode,
        note: note ?? null,
        deliveryLocation: deliveryLocation ?? null,
        status: "PLACED",
        orderItems: {
          create: cartItems.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            unitPrice: item.menuItem.price, // ← PRICE SNAPSHOT: captures price at order time
          })),
        },
      },
    });

    // Clear cart — if this fails, the order rolls back too
    await tx.cartItem.deleteMany({ where: { userId: session.user.id } });

    return newOrder;
  });

  return NextResponse.json(order, { status: 201 });
}
```

### Key Design Decisions

**1. `unitPrice` Snapshot on OrderItem**
> "We store `unitPrice` on each `OrderItem` at order time instead of always reading from `MenuItem.price`. This means historical orders always reflect what was actually charged, even if the vendor changes prices later. Critical for accounting and dispute resolution."

**2. Atomic Transaction**
> "Creating the order and clearing the cart happen inside a single Prisma `$transaction`. If either fails, both roll back. You never end up with an order placed but cart items not cleared, or vice versa."

**3. Order starts as PLACED**
> "The order is created with status `PLACED`. It won't move to `CONFIRMED` until the Razorpay webhook fires and verifies the payment. This gives us a clear audit trail."

---

## Step 2: Checkout Page

**File:** `app/(student)/checkout/page.tsx`

The order ID is stored in `sessionStorage` so it survives page refreshes. The checkout page:

1. Fetches the order from `/api/orders/[orderId]` with full details
2. Shows vendor info and order mode
3. Displays bill breakdown:
   - Item total
   - Platform fee (₹5)
   - Delivery charge (FREE if delivery mode)
   - **Grand total**
4. Payment method selector (UPI / NetBanking)
5. Sticky bottom "Pay" button

```typescript
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

async function handlePayment() {
  if (!order) return;
  setPaymentLoading(true);
  setError(null);

  // ── DEMO MODE: Bypass real payment
  if (DEMO_MODE) {
    sessionStorage.setItem("demoOrderId", order.id);
    sessionStorage.setItem("demoTotal", String(Number(order.totalAmount) + PLATFORM_FEE));
    sessionStorage.setItem("demoVendor", order.vendor.name);
    sessionStorage.setItem("demoPaymentMethod", selectedMethod);
    router.push("/demo-payment");
    setPaymentLoading(false);
    return;
  }

  // ── REAL RAZORPAY FLOW
  try {
    // Step 3: Create Razorpay order server-side
    const res = await fetch("/api/razorpay/create-order", { ... });
    // ... open Razorpay modal
  } catch (err: any) {
    setError(err.message || "Something went wrong. Please try again.");
    setPaymentLoading(false);
  }
}
```

### Edge Case — Already Paid

```typescript
useEffect(() => {
  fetchOrder(orderId);
  loadRazorpayScript();
}, [router, status]);

async function fetchOrder(orderId: string) {
  const data = await res.json();
  setOrder(data);
  if (data.payment?.status === "SUCCESS") setPaymentState("success");
  // If already paid, skip to success UI immediately
}
```

---

## Step 3: Create Razorpay Order

**File:** `app/api/razorpay/create-order/route.ts`

This is the most security-critical API route. It has **5 layers of security checks** before creating the Razorpay order.

```typescript
import Razorpay from "razorpay";
import { PLATFORM_FEE } from "@/lib/constants";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: NextRequest) {
  // ── Layer 1: Rate limiting (100 req / 60s)
  const rl = await checkRateLimit(paymentRateLimit, req);
  if (rl) return rl;

  // ── Layer 2: Authentication
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await req.json();

  // ── Layer 3: Input validation
  if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });

  // ── Layer 4: Order exists
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { vendor: { select: { name: true } } },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // ── Layer 5: Ownership check — only the order owner can pay
  if (order.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Calculate total with platform fee
  const totalWithFee = Number(order.totalAmount) + PLATFORM_FEE; // ₹5

  // ── Create Razorpay order (amount in paise: INR × 100)
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(totalWithFee * 100), // e.g. ₹125 → 12500 paise
    currency: "INR",
    receipt: orderId,          // Links Razorpay order to our DB order
    notes: {
      platform: "MessLess",
      vendor: order.vendor.name,
      studentId: session.user.id,
    },
  });

  // ── Save/update Payment record with Razorpay order ID
  await prisma.payment.upsert({
    where: { orderId },
    update: { razorpayOrderId: razorpayOrder.id, amount: totalWithFee },
    create: {
      orderId,
      razorpayOrderId: razorpayOrder.id,
      amount: totalWithFee,
      status: "PENDING",
    },
  });

  // ── Return data for the frontend to open the Razorpay modal
  return NextResponse.json({
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,       // in paise
    currency: razorpayOrder.currency,
    keyId: process.env.RAZORPAY_KEY_ID,  // Public key — safe to expose
    vendorName: order.vendor.name,
    studentName: session.user.name,
    studentEmail: session.user.email,
  });
}
```

### Why the Ownership Check Matters

> "Without this check, Student A could guess or steal Student B's order ID and make a payment on their behalf. The 403 Forbidden response prevents this. We check `order.userId !== session.user.id`."

### Why `upsert` Instead of `create`

> "If the user somehow clicks 'Pay' twice before the modal opens, the second call would try to create a duplicate Payment record. The unique constraint on `orderId` would throw. `upsert` handles this gracefully — it updates the existing record instead of crashing."

---

## Step 4: Razorpay Checkout Modal

**File:** `app/(student)/checkout/page.tsx`

### Dynamic Script Loading

The Razorpay `checkout.js` script is loaded **only when the user clicks Pay** — not on page load. This saves bandwidth and avoids third-party script blocking.

```typescript
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window.Razorpay !== "undefined") {
      resolve(true);  // Already loaded
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);  // CDN down / ad blocker
    document.body.appendChild(script);
  });
}
```

### Opening the Modal

```typescript
const scriptLoaded = await loadRazorpayScript();
if (!scriptLoaded) throw new Error("Payment gateway failed to load.");

const rzp = new window.Razorpay({
  key: keyId,
  amount,                       // In paise
  currency,
  name: "MessLess",
  description: `Order from ${vendorName}`,
  order_id: razorpayOrderId,    // Links to the server-side Razorpay order
  prefill: {
    name: studentName,
    email: studentEmail,
  },
  theme: { color: "#9B1B1B" },  // Brand color

  // ── SUCCESS HANDLER
  handler: async function (response) {
    // Forward to our webhook for server-side verification
    const verifyRes = await fetch("/api/razorpay/webhook", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      }),
    });
    if (!verifyRes.ok) throw new Error("Payment verification failed.");
    sessionStorage.removeItem("pendingOrderId");
    setPaymentState("success");
  },

  // ── DISMISS HANDLER (user closes modal without paying)
  modal: {
    ondismiss: () => {
      setPaymentLoading(false);
      setError("Payment cancelled. You can try again.");
    },
  },
});

// ── FAILURE HANDLER
rzp.on("payment.failed", function (response) {
  setPaymentState("failed");
  setError(`Payment failed: ${response.error.description}`);
});

rzp.open();  // Open the modal
```

### Three Possible Outcomes

| Outcome | UX | What Happens Backend |
|---|---|---|
| **SUCCESS** | Green checkmark → "Track my order" | Webhook fires → Payment: SUCCESS, Order: CONFIRMED |
| **FAILED** | Red error → "Try again" or "Back to cart" | Nothing — payment never completed |
| **DISMISSED** | "Payment cancelled, you can try again" | Nothing — user can try again |

---

## Step 5: Webhook Verification

**File:** `app/api/razorpay/webhook/route.ts`

**This is the most critical security component.** Razorpay calls this server-to-server after a payment completes. We **never trust the frontend's success handler alone** — the webhook is the source of truth.

```typescript
import crypto from "crypto";

export async function POST(req: NextRequest) {
  // ── Rate limiting
  const rl = await checkRateLimit(paymentRateLimit, req);
  if (rl) return rl;

  const body = await req.json();
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  // ── Layer 1: Validate required fields
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // ── Layer 2: HMAC-SHA256 verification — PREVENTS FAKE WEBHOOKS
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)        // ← Server-side secret
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)          // ← Razorpay's official format
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── Layer 3: Find our Payment record by Razorpay order ID
  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: razorpay_order_id },
  });
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // ── Layer 4: Atomic update — BOTH succeed or BOTH roll back
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESS",
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        paidAt: new Date(),
      },
    }),
    prisma.order.update({
      where: { id: payment.orderId },
      data: { status: "CONFIRMED" },  // ← Order moves from PLACED → CONFIRMED
    }),
  ]);

  return NextResponse.json({ success: true });
}
```

### Why HMAC-SHA256?

> "Anyone could call our webhook URL and claim a payment succeeded. But because we recompute the HMAC signature using the server-side `RAZORPAY_KEY_SECRET` (which never reaches the frontend), we can cryptographically prove that the signature was generated by Razorpay. If it doesn't match, we reject it."

**How HMAC works in this context:**
```
Razorpay computes: HMAC-SHA256(RAZORPAY_KEY_SECRET, "order_id|payment_id")
We compute:        HMAC-SHA256(SAME_SECRET, "order_id|payment_id")
If they match → Authentic (only Razorpay and our server know the secret)
If they differ → Fake (rejected with 400)
```

### Why Atomic Transaction?

> "The webhook updates two records: Payment status to SUCCESS and Order status to CONFIRMED. These are inside a Prisma `$transaction`. If the Payment update succeeds but the Order update fails (or vice versa), both roll back. This prevents inconsistent states — we can never have a paid order stuck in PLACED, or an unpaid order marked CONFIRMED."

### Database-Level Safety Nets

```prisma
model Payment {
  orderId           String  @unique                    // One payment per order
  razorpayOrderId   String? @unique                    // Prevents duplicate Razorpay orders
  razorpayPaymentId String? @unique                    // Prevents double-processing same payment
}
```

> "Unique constraints on `razorpayOrderId` and `razorpayPaymentId` serve as last-resort guards. If somehow the same payment ID arrives twice, the second insert/update simply won't create a duplicate."

---

## Step 6: Success UI

After payment succeeds, the user sees:

```
┌──────────────────────────────┐
│                              │
│           ✅                 │
│                              │
│    Order placed! 🎉          │
│    Your order at WrapChik    │
│    is confirmed.             │
│                              │
│    We'll notify you when     │
│    your order is ready.      │
│                              │
│    ┌────────────────────┐    │
│    │ Burger × 1    ₹50  │    │
│    │ Paneer × 2   ₹110  │    │
│    │───────────────      │    │
│    │ Total paid   ₹165  │    │
│    └────────────────────┘    │
│                              │
│    [Track my order →]        │
│    [Order something else]    │
│                              │
└──────────────────────────────┘
```

Contextual message based on order mode:
- **Delivery:** "Your order will be delivered to you shortly."
- **Dine In:** "Please find your seat — your order is being prepared."
- **Takeaway:** "We'll notify you when your order is ready for pickup."

---

## Demo Mode

**File:** `app/(student)/demo-payment/page.tsx`

When `NEXT_PUBLIC_DEMO_MODE === "true"`, the real Razorpay flow is completely bypassed. Instead:

1. Order details are saved to `sessionStorage`
2. User is redirected to `/demo-payment`
3. An animated progress bar simulates payment processing
4. After ~3 seconds, auto-redirects to `/orders`
5. Success shows a checkmark with total, vendor, and payment method

This allows seamless demos without:
- Real Razorpay API keys
- Spending actual money
- Internet connectivity to Razorpay's CDN

---

## Why This Is Technically Challenging

### 1. 🔐 HMAC-SHA256 Signature Verification

> "The most important security measure is HMAC verification on the webhook. Anyone could potentially call our webhook URL and claim a payment succeeded. But because we recompute the HMAC signature using the server-side `RAZORPAY_KEY_SECRET` (which never reaches the frontend), we can cryptographically prove that the signature was generated by Razorpay. If it doesn't match, we reject it — no questions asked."

### 2. 🔄 Atomic Transactions (Prisma `$transaction`)

> "The payment webhook updates two records: the Payment status (to SUCCESS) and the Order status (to CONFIRMED). These are wrapped in a Prisma `$transaction`. If either update fails, both roll back. This means we can never have a state where the payment is marked SUCCESS but the order is stuck in PLACED, or vice versa."

### 3. 🛡️ Defense in Depth — 5 Layers of Security

| Layer | What | Where |
|---|---|---|
| 1. Rate Limiting | 100 req / 60s for payment routes | `paymentRateLimit` |
| 2. Authentication | Must be logged in | `getServerSession()` |
| 3. Order Ownership | Only the order's owner can pay | Ownership check `order.userId !== session.user.id` |
| 4. Input Validation | Required fields check | Both endpoints |
| 5. HMAC Verification | Cryptographically proves webhook authenticity | Webhook route |

### 4. 🗃️ Database-Level Safety Nets

- **`orderId` unique** — One payment per order
- **`razorpayOrderId` unique** — No duplicate Razorpay orders
- **`razorpayPaymentId` unique** — No double-crediting of same payment
- **Composite unique `@@unique([userId, menuItemId])`** on CartItem

### 5. 🧪 Price Snapshot (Data Integrity)

> "The `unitPrice` is stored on `OrderItem` at the time of order creation — NOT read dynamically from `MenuItem.price`. This means if a vendor changes their prices later, every historical order still shows what was actually charged. This is critical for accounting, refunds, and dispute resolution."

### 6. 💰 Transparent Platform Fee

> "A ₹5 platform fee is added in a single location (`lib/constants.ts`) and applied both server-side and displayed client-side. The bill breakdown shows exactly how the total is calculated — no hidden fees."

### 7. ⚡ Dynamic Script Loading

> "The Razorpay checkout script is loaded dynamically only when the user clicks 'Pay', not on initial page load. This saves bandwidth, avoids blocking page render, and gracefully handles cases where the CDN is down or blocked by an ad blocker."

---

## The Flow Diagram

```
[Student clicks "Pay"]
        │
        ▼
┌─────────────────────────┐
│  POST /api/razorpay/    │
│  create-order           │
│                         │
│  • Check auth & owner   │  ← 5 security layers
│  • Calculate total+fee  │
│  • Create Razorpay      │
│    order (server SDK)   │
│  • Save Payment record  │
│    (status: PENDING)    │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  Razorpay Checkout      │
│  Modal Opens            │
│                         │
│  User enters UPI/Card   │
│  /Netbanking details    │
└──────┬──────┬──────┬────┘
       │      │      │
    SUCCESS  FAIL   DISMISS
       │      │      │
       ▼      ▼      ▼
┌────────┐ ┌────┐ ┌──────────┐
│Webhook │ │Show│ │"Cancel-  │
│ fires  │ │err │ │led, try  │
│ server-│ │msg │ │again"    │
│ side   │ │    │ │          │
└───┬────┘ └────┘ └──────────┘
    │
    ▼
┌─────────────────────────────┐
│  POST /api/razorpay/        │
│  webhook                    │
│                             │
│  • HMAC-SHA256 verify       │  ← Cryptographically proves authenticity
│  • Find Payment record      │
│  • Prisma $transaction:     │  ← Atomic: both succeed or both roll back
│    → Payment: SUCCESS       │
│    → Order: CONFIRMED       │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────┐
│  Success Page            │
│  "Track my order →"     │
│  Redirects to /orders   │
└─────────────────────────┘
```

---

## Security Layers Summary

```
Request arrives
    │
    ▼
┌──────────────────────┐
│ 1. Rate Limiting     │  ← Block if > 100 req in 60s
│    (paymentRateLimt) │
└──────────┬───────────┘
           │ (passed)
           ▼
┌──────────────────────┐
│ 2. Authentication    │  ← Must have valid JWT session
│    (getServerSession)│
└──────────┬───────────┘
           │ (passed)
           ▼
┌──────────────────────┐
│ 3. Input Validation  │  ← Must have orderId, all webhook fields
│    (missing field    │
│     checks)          │
└──────────┬───────────┘
           │ (passed)
           ▼
┌──────────────────────────┐
│ 4. Business Logic Checks │  ← Order exists? User owns order?
│    (ownership, existence)│
└──────────┬───────────────┘
           │ (passed)
           ▼
┌──────────────────────────┐
│ 5. Cryptographic Verify  │  ← HMAC-SHA256 (webhook only)
│    (fake webhook         │
│     prevention)          │
└──────────┬───────────────┘
           │ (passed)
           ▼
┌──────────────────────────┐
│ 6. Database Constraints  │  ← Unique constraints prevent
│    (last-resort guards)  │     duplicate processing
└──────────┬───────────────┘
           │ (passed)
           ▼
┌──────────────────────────┐
│ 7. Atomic Transaction    │  ← Payment + Order update
│    (Prisma $transaction) │     both succeed or both roll back
└──────────────────────────┘
```

---

## Interview Answer — 30-Second Summary

> **"The payment flow uses Razorpay with server-side webhook verification. When a user clicks Pay, we first create a Razorpay order on our server — verifying authentication, order ownership, and adding the platform fee. Then the frontend opens the Razorpay checkout modal. On success, Razorpay calls our webhook server-to-server. We verify the HMAC-SHA256 signature to cryptographically prove authenticity, then atomically update both the Payment record (to SUCCESS) and Order status (to CONFIRMED) inside a single Prisma `$transaction`. If either update fails, both roll back — so we never have inconsistent state. Additionally, unique constraints on the Payment table prevent double-processing of the same payment, and a price snapshot on OrderItem ensures historical orders always reflect the correct amount charged."**

---

*MessLess · Made by Thapar, for Thapar*
*GitHub: github.com/sohamsachdeva/messless*
