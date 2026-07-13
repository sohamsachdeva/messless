# 🛡️ MessLess — Edge Cases & Error Handling Breakdown

> Full-Stack Campus Food Ordering Platform | Thapar Institute of Engineering & Technology

---

## Table of Contents

1. [Authentication & Authorization](#1-authentication--authorization-edge-cases)
2. [Cart Edge Cases](#2-cart-edge-cases)
3. [Order Edge Cases](#3-order-edge-cases)
4. [Payment Edge Cases](#4-payment-edge-cases)
5. [OTP Edge Cases](#5-otp-edge-cases)
6. [Registration Edge Cases](#6-registration-edge-cases)
7. [API & Rate Limiting](#7-api--rate-limiting-edge-cases)
8. [UI/UX Edge Cases](#8-uiux-edge-cases)
9. [Database & Data Integrity](#9-database--data-integrity-edge-cases)
10. [The Interview-Ready Summary](#10-summary--the-interview-ready-answer)

---

## 1. Authentication & Authorization Edge Cases

### 🔴 Vendor tries to login before admin approval
**Where:** `lib/auth.ts` (NextAuth `authorize` callback)
**What happens:** The vendor's User record exists, but their associated Vendor has `isApproved: false`. The `authorize` function throws a specific error that gets shown on the login page.
```typescript
const vendor = await prisma.vendor.findFirst({
  where: { ownerId: user.id, isApproved: true },
});
if (!vendor) {
  throw new Error("Your vendor account is pending admin approval.");
}
```

### 🔴 Non-thapar email tries to login
**Where:** `lib/auth.ts` (Google signIn callback) + `app/(auth)/login/page.tsx`
**What happens:** Two layers of protection. Google OAuth blocks non-`@thapar.edu` emails at the provider callback level. The credentials form also validates client-side before sending.
```typescript
// Middleware level
if (!email.endsWith("@thapar.edu")) return false;

// Frontend level (before API call)
if (!email.endsWith("@thapar.edu")) {
  setError("Only @thapar.edu emails are allowed.");
  return;
}
```

### 🔴 Vendor tries to login via email path (instead of phone)
**Where:** `lib/auth.ts`
**What happens:** If someone tries to login with a vendor's email through the student credential path, the code explicitly checks `if (user.role === Role.VENDOR) return null;` — vendors can ONLY login via phone number.

### 🔴 Expired or revoked session
**Where:** `middleware.ts`
**What happens:** NextAuth middleware checks for a valid JWT token before allowing access to any protected route. If missing or expired, user is redirected to `/login`.

### 🔴 Wrong role tries to access restricted pages
**Where:** `middleware.ts` + `app/unauthorized/page.tsx`
**What happens:** Admin routes check for ADMIN role. Vendor routes check for VENDOR or ADMIN. If wrong role, user gets a dedicated 403 "Access Denied" page (not a generic 404).
```typescript
if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
  return NextResponse.redirect(new URL("/unauthorized", req.url));
}
```

### 🔴 Student tries to directly access `/vendor/dashboard` via URL
**Where:** `middleware.ts`
**What happens:** The middleware explicitly checks the role for vendor routes. A student can edit the URL, but middleware catches them and redirects to `/unauthorized`.

### 🔴 Google OAuth for first-time user auto-creates account
**Where:** `lib/auth.ts` (signIn callback)
**What happens:** If a valid `@thapar.edu` Google user doesn't exist in the database yet, the signIn callback automatically creates their User record with role STUDENT — no manual registration needed.

---

## 2. Cart Edge Cases

### 🔴 Adding item from a different vendor (cross-vendor cart mixing)
**Where:** `app/api/cart/route.ts`
**What happens:** The API checks if the cart already has items. If yes, and the new item belongs to a different vendor, it returns **409 Conflict** with code `DIFFERENT_VENDOR`. This prevents mixing items from WrapChik and Dessert Club in the same cart.
```typescript
if (existingCartItem && existingCartItem.menuItem.vendorId !== menuItem.vendorId) {
  return NextResponse.json(
    { error: "DIFFERENT_VENDOR", message: "Your cart has items from another shop. Clear cart to add from this shop." },
    { status: 409 }
  );
}
```

### 🔴 Adding an item that's no longer available
**Where:** `app/api/cart/route.ts`
**What happens:** Before adding to cart, the API fetches the menu item and checks `isAvailable`. If the vendor has toggled it off or it was rejected by admin, the API returns 404.
```typescript
if (!menuItem || !menuItem.isAvailable) {
  return NextResponse.json({ error: "Item not available" }, { status: 404 });
}
```

### 🔴 Quantity drops to 0 (or below) on update
**Where:** `app/api/cart/[itemId]/route.ts`
**What happens:** When a user reduces quantity and it drops below 1, the item is **automatically deleted** from the cart rather than persisting with 0 quantity.
```typescript
if (quantity < 1) {
  await prisma.cartItem.deleteMany({
    where: { id: itemId, userId: session.user.id },
  });
  return NextResponse.json({ deleted: true });
}
```

### 🔴 Placing order with empty cart
**Where:** `app/api/orders/route.ts`
**What happens:** The API fetches the cart first. If empty, returns 400 — you can't place an empty order.
```typescript
if (cartItems.length === 0) {
  return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
}
```

### 🔴 Duplicate cart item (same user adds same item twice)
**Where:** Prisma schema `@@unique([userId, menuItemId])` + Prisma `upsert` in API
**What happens:** The DB has a composite unique constraint on `(userId, menuItemId)`. The API uses Prisma's `upsert` — so adding the same item again just **increments the quantity** instead of creating a duplicate row.
```typescript
const cartItem = await prisma.cartItem.upsert({
  where: { userId_menuItemId: { userId: session.user.id, menuItemId } },
  update: { quantity: { increment: quantity } },
  create: { userId: session.user.id, menuItemId, quantity },
});
```

---

## 3. Order Edge Cases

### 🔴 Order status state machine (invalid transitions)
**Where:** `app/api/vendor/orders/route.ts`
**What happens:** This is the most robust edge case handler. Orders can only move through specific valid transitions. Trying to jump from PLACED to PICKED_UP or from READY back to PREPARING returns a 400 with a clear error message showing the allowed transitions.
```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  PLACED:    ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY:     ["PICKED_UP", "CANCELLED"],
  PICKED_UP: [],    // Terminal state — no further transitions
  CANCELLED: [],    // Terminal state — no further transitions
};

const allowed = VALID_TRANSITIONS[order.status] ?? [];
if (!allowed.includes(status)) {
  return NextResponse.json(
    { error: `Cannot transition from ${order.status} to ${status}. Allowed: ${allowed.join(", ") || "none"}` },
    { status: 400 }
  );
}
```

### 🔴 Student tries to view another student's order
**Where:** `app/api/orders/[orderId]/route.ts`
**What happens:** The API checks that the requesting user's ID matches the order's `userId` OR the user is an ADMIN. If not, returns 403 Forbidden.
```typescript
if (order.userId !== session.user.id && session.user.role !== "ADMIN") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### 🔴 Vendor tries to update another vendor's order
**Where:** `app/api/vendor/orders/route.ts` (PATCH handler)
**What happens:** Before updating order status, the API fetches the vendor associated with the order and checks `order.vendor.ownerId !== session.user.id`. This prevents Vendor A from messing with Vendor B's orders.
```typescript
if (order.vendor.ownerId !== session.user.id) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### 🔴 Student tries to pay for an order that isn't theirs
**Where:** `app/api/razorpay/create-order/route.ts`
**What happens:** Before creating the Razorpay payment order, the API checks `order.userId !== session.user.id` and returns 403. This prevents payment hijacking.
```typescript
if (order.userId !== session.user.id) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### 🔴 Order creation is atomic (all-or-nothing)
**Where:** `app/api/orders/route.ts`
**What happens:** Creating an order and clearing the cart happen inside a single Prisma `$transaction`. If either fails, both roll back. You never end up with an order placed but cart items not cleared, or vice versa.
```typescript
const order = await prisma.$transaction(async (tx) => {
  const newOrder = await tx.order.create({ data: { ... } });
  await tx.cartItem.deleteMany({ where: { userId: session.user.id } });
  return newOrder;
});
```

---

## 4. Payment Edge Cases

### 🔴 Duplicate/callback webhook (Razorpay calls webhook twice)
**Where:** `app/api/razorpay/webhook/route.ts` + Prisma schema
**What happens:** The `razorpayPaymentId` field has a **unique constraint** in the DB. If the same payment ID arrives twice, the second update is idempotent and won't double-credit the payment.
```prisma
model Payment {
  razorpayPaymentId String? @unique  // Prevents duplicate processing
}
```

### 🔴 Payment + Order status atomic update
**Where:** `app/api/razorpay/webhook/route.ts`
**What happens:** Both the payment update (to SUCCESS) and order status update (to CONFIRMED) happen inside a single Prisma `$transaction`. If one succeeds and the other fails, the entire operation rolls back. No inconsistent state.
```typescript
await prisma.$transaction([
  prisma.payment.update({
    where: { id: payment.id },
    data: { status: "SUCCESS", razorpayPaymentId, razorpaySignature, paidAt: new Date() },
  }),
  prisma.order.update({
    where: { id: payment.orderId },
    data: { status: "CONFIRMED" },
  }),
]);
```

### 🔴 Fake webhook (HMAC signature mismatch)
**Where:** `app/api/razorpay/webhook/route.ts`
**What happens:** Every webhook call includes `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`. The server recomputes the HMAC-SHA256 signature using the secret key and compares it. If it doesn't match, the webhook is rejected. This prevents anyone from faking a successful payment.
```typescript
const expectedSignature = crypto
  .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
  .update(`${razorpay_order_id}|${razorpay_payment_id}`)
  .digest("hex");

if (expectedSignature !== razorpay_signature) {
  return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
}
```

### 🔴 User closes Razorpay modal (payment cancelled)
**Where:** `app/(student)/checkout/page.tsx`
**What happens:** The Razorpay modal has an `ondismiss` handler that resets the loading state and shows a friendly "Payment cancelled, you can try again" message. The user doesn't lose their order.
```typescript
modal: {
  ondismiss: () => {
    setPaymentLoading(false);
    setError("Payment cancelled. You can try again.");
  },
}
```

### 🔴 Razorpay script fails to load (CDN down / ad blocker)
**Where:** `app/(student)/checkout/page.tsx`
**What happens:** The `checkout.js` script is loaded dynamically. `loadRazorpayScript()` returns a Promise that resolves when loaded. If the CDN is blocked, a meaningful error is shown instead of silent failure.
```typescript
const scriptLoaded = await loadRazorpayScript();
if (!scriptLoaded) throw new Error("Payment gateway failed to load.");
```

### 🔴 Missing required webhook fields
**Where:** `app/api/razorpay/webhook/route.ts`
**What happens:** The webhook handler validates that all three required fields exist before attempting verification. If any are missing, returns 400 immediately.
```typescript
if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
  return NextResponse.json({ error: "Missing fields" }, { status: 400 });
}
```

### 🔴 Demo mode — skip real payments entirely
**Where:** `app/(student)/checkout/page.tsx`
**What happens:** When `NEXT_PUBLIC_DEMO_MODE === "true"`, clicking "Pay" redirects to a mock payment page instead of calling Razorpay. This makes demos seamless without needing real API keys.
```typescript
if (DEMO_MODE) {
  sessionStorage.setItem("demoOrderId", order.id);
  router.push("/demo-payment");
  return;
}
```

---

## 5. OTP Edge Cases

### 🔴 OTP expired (10 minute window)
**Where:** `lib/otp.ts` + `app/(auth)/register/page.tsx`
**What happens:** OTPs have `expiresAt` set to 10 minutes from creation. On verification, the code checks if the current time exceeds it. If expired, the OTP record is deleted and the user gets a clear message. The frontend also has a countdown timer.
```typescript
if (new Date() > otp.expiresAt) {
  await prisma.oTP.delete({ where: { id: otp.id } });
  return { success: false, error: "OTP has expired. Please request a new one." };
}
```

### 🔴 Too many OTP attempts (max 5 before auto-delete)
**Where:** `lib/otp.ts`
**What happens:** Each failed attempt increments `attempts`. After 5 wrong attempts, the OTP record is deleted and a new one must be requested. This prevents brute-force guessing of OTP codes.
```typescript
if (otp.attempts >= MAX_ATTEMPTS) {
  await prisma.oTP.delete({ where: { id: otp.id } });
  return { success: false, error: "Too many incorrect attempts. Please request a new OTP." };
}
```

### 🔴 User clicks "Resend OTP" too quickly (rate limit)
**Where:** `lib/otp.ts`
**What happens:** Before creating a new OTP, the code checks if a recent OTP exists (within 1 minute). If found, it calculates the remaining wait time and throws a descriptive error.
```typescript
const recent = await prisma.oTP.findFirst({
  where: { target, type, createdAt: { gte: new Date(Date.now() - 60000) } },
});
if (recent) {
  const waitSeconds = Math.ceil((60000 - (Date.now() - recent.createdAt.getTime())) / 1000);
  throw new Error(`Please wait ${waitSeconds} seconds before requesting another OTP.`);
}
```

### 🔴 SMTP not configured (graceful fallback in dev)
**Where:** `lib/otp.ts`
**What happens:** If `SMTP_EMAIL` or `SMTP_PASSWORD` aren't set, the email function gracefully skips sending and just logs the OTP to console. The app still works for development without email setup.
```typescript
if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
  console.log(`📧 SMTP not configured — OTP for ${email}: ${otp}`);
  return;
}
```

### 🔴 Demo mode OTP (always "123456")
**Where:** `lib/otp.ts`
**What happens:** When `NEXT_PUBLIC_DEMO_MODE === "true"` or `NODE_ENV !== "production"`, the generated OTP is always `"123456"`. This makes demos seamless — no need to check emails or SMS.
```typescript
const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const code = (process.env.NODE_ENV !== "production" || isDemo) ? "123456" : generateOTP();
```

### 🔴 OTP not found (user enters wrong target)
**Where:** `lib/otp.ts`
**What happens:** When verifying, if no OTP record exists for the given target + type combo, the function returns a specific error rather than crashing.
```typescript
if (!otp) {
  return { success: false, error: "No OTP found. Please request a new one." };
}
```

---

## 6. Registration Edge Cases

### 🔴 Duplicate email registration
**Where:** `app/api/auth/register/route.ts`
**What happens:** The API checks for existing user with same email OR thaparId. If found, returns 409 Conflict with the specific field that's duplicated.
```typescript
const existing = await prisma.user.findFirst({
  where: { OR: [{ email }, ...(thaparId ? [{ thaparId }] : [])] },
});
if (existing) {
  if (existing.email === email) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }
  return NextResponse.json({ error: "This Thapar ID is already registered." }, { status: 409 });
}
```

### 🔴 Duplicate vendor phone number
**Where:** `app/api/auth/vendor-register/route.ts`
**What happens:** Same pattern — checks for existing user with same phone and VENDOR role. Returns 409 with a clear message.
```typescript
const existing = await prisma.user.findFirst({
  where: { phone, role: "VENDOR" },
});
if (existing) {
  return NextResponse.json({ error: "This phone number is already registered. Please sign in." }, { status: 409 });
}
```

### 🔴 Registration without OTP verification
**Where:** `app/api/auth/register/route.ts` + `app/api/auth/vendor-register/route.ts`
**What happens:** Both registration endpoints require a verified OTP record in the DB. If no verified OTP exists within the expiry window, registration is blocked with 403. This prevents direct API calls that skip the OTP step.
```typescript
const verifiedOTP = await prisma.oTP.findFirst({
  where: { target: email, type: "EMAIL_VERIFY", verified: true, expiresAt: { gte: new Date() } },
});
if (!verifiedOTP) {
  return NextResponse.json({ error: "Email not verified. Please verify your email with OTP first." }, { status: 403 });
}
```

### 🔴 Invalid Thapar ID format
**Where:** `app/(auth)/register/page.tsx`
**What happens:** Both client-side (React state) and server-side validate the Thapar ID is exactly 10 digits. The input field has `maxLength={10}` and a regex check.
```typescript
if (thaparId && !/^\d{10}$/.test(thaparId)) {
  errs.thaparId = "Must be exactly 10 digits";
}
```

### 🔴 Password too short
**Where:** `app/(auth)/register/page.tsx` + `app/api/auth/register/route.ts`
**What happens:** Both client and server validate minimum 8 characters. The client shows a password strength indicator and inline error.
```typescript
if (password.length < 8) {
  errs.password = "Min 8 characters";
}
```

### 🔴 Passwords don't match during registration
**Where:** `app/(auth)/register/page.tsx`
**What happens:** Client-side validation checks confirm password matches before sending OTP. No round-trip to server needed.
```typescript
if (password !== confirm) {
  errs.confirm = "Passwords do not match";
}
```

### 🔴 Vendor enters shop name that's too short
**Where:** `app/(auth)/login/page.tsx`
**What happens:** Shop name must be at least 2 characters. Validated client-side before sending OTP request.
```typescript
if (!shopName.trim() || shopName.trim().length < 2) {
  setRegError("Enter a valid shop name.");
  return;
}
```

---

## 7. API & Rate Limiting Edge Cases

### 🔴 Too many requests (rate limiting on every endpoint)
**Where:** `lib/rateLimiter.ts` + `lib/rateLimiterMemory.ts`
**What happens:** Every single API route calls `checkRateLimit()` at the top. Different route categories have different limits. If exceeded, returns 429 with `Retry-After` header.

| Route Category | Limit | Purpose |
|---|---|---|
| Auth routes | 10 req / 10s | Prevents brute-force on login/register |
| General API | 60 req / 60s | Browsing hubs, search, menu |
| Admin routes | 30 req / 60s | Sensitive admin endpoints |
| Cart & Orders | 30 req / 60s | Write-heavy operations |
| Payments | 100 req / 60s | Allows webhook retries |

```typescript
export function rateLimitResponse(): Response {
  return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": "10" },
  });
}
```

### 🔴 Missing required fields in request body
**Where:** Every API route
**What happens:** All API routes validate required fields at the top. Missing fields return 400 with a descriptive message.
```typescript
if (!name || !email || !password) {
  return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
}
```

### 🔴 No search query (minimum 2 characters)
**Where:** `app/api/search/route.ts` + `app/(student)/browse/page.tsx`
**What happens:** The search API returns empty results for queries shorter than 2 characters. The frontend debounces the search (300ms) and only fires when `searchQuery.length >= 2`.
```typescript
// API level
if (q.length < 2) {
  return NextResponse.json({ vendors: [], hubs: [] });
}

// Frontend level (debounced)
if (!searchQuery.trim() || searchQuery.length < 2) {
  setSearchResults({ vendors: [], hubs: [] });
  return;
}
```

### 🔴 Unauthenticated user hits protected API
**Where:** All protected API routes
**What happens:** Every route that requires auth calls `getServerSession(authOptions)` at the top. If missing, immediately returns 401.
```typescript
const session = await getServerSession(authOptions);
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

### 🔴 Vendor tries to manage menu without an approved shop
**Where:** `app/api/vendor/menu-items/route.ts`
**What happens:** Even though middleware blocks unauthenticated users, the API additionally checks that the vendor is approved. A vendor might have a User record but no approved Vendor record.
```typescript
const vendor = await prisma.vendor.findFirst({
  where: { ownerId: session.user.id, isApproved: true },
});
if (!vendor) {
  return NextResponse.json({ error: "Your vendor account is not approved yet" }, { status: 403 });
}
```

### 🔴 Vendor tries to modify another vendor's menu item
**Where:** `app/api/vendor/menu-items/[iItemId]/route.ts`
**What happens:** Before updating or deleting, the API fetches the item with its vendor, and checks `item.vendor.ownerId !== session.user.id`. This prevents menu tampering between vendors.
```typescript
if (!item || item.vendor.ownerId !== session.user.id) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

### 🔴 Demo-only endpoint used in production
**Where:** `app/api/demo/advance-order/[orderId]/route.ts`
**What happens:** The demo advance-order API explicitly checks `NODE_ENV` and returns 403 if called in production. This ensures demo shortcuts don't accidentally work in the live environment.
```typescript
if (process.env.NODE_ENV === "production") {
  return NextResponse.json({ error: "Not available" }, { status: 403 });
}
```

---

## 8. UI/UX Edge Cases

### 🔴 Unapproved vendor sees "pending approval" screen
**Where:** `app/vendor/dashboard/page.tsx`
**What happens:** If `isApproved` is false on the vendor record, the dashboard shows a friendly pending screen instead of a blank dashboard or error. It displays the shop name and registered phone for reference.
```typescript
if (!vendor?.isApproved) {
  return (
    <main>
      <div style={{ fontSize: 56 }}>⏳</div>
      <h2>Account pending approval</h2>
      <p>Your vendor registration for <strong>{vendor?.name}</strong> is under review...</p>
    </main>
  );
}
```

### 🔴 Vendor successfully registers — shows confirmation with phone
**Where:** `app/(auth)/login/page.tsx`
**What happens:** After vendor registration succeeds, a success screen shows the shop name, registered phone number, and a note that approval takes ~24 hours. No silent failure.
```typescript
return (
  <div>
    <div>✅</div>
    <h3>Registration submitted!</h3>
    <p>Your shop <strong>{shopName}</strong> is pending admin approval...</p>
    <div>📱 Registered with: +91 {regPhone}</div>
    <button>Back to vendor login</button>
  </div>
);
```

### 🔴 Shop closed — menu items still visible but not addable
**Where:** `app/(student)/vendor/[id]/page.tsx`
**What happens:** When a vendor is closed (outside operating hours), their menu items are still visible (so students can plan ahead) but all "Add" buttons are replaced with a "Closed" label. The entire page has reduced opacity to visually indicate unavailability.

### 🔴 Empty cart state
**Where:** `app/(student)/cart/page.tsx`
**What happens:** Shows a friendly empty state with an emoji (🛒), message "Your cart is empty", and a "Browse shops" call-to-action button that navigates back to the hubs page.

### 🔴 No orders state (different messages per filter tab)
**Where:** `app/(student)/orders/page.tsx`
**What happens:** Shows contextual empty messages based on the active filter — "No active orders", "No completed orders yet", or "No orders yet" — each with a CTA to order.

### 🔴 Root page redirect logic
**Where:** `app/page.tsx`
**What happens:** The root page checks session status. Unauthenticated → `/login`. Authenticated → role-based redirect: STUDENT → `/browse`, VENDOR → `/vendor/dashboard`, ADMIN → `/admin/dashboard`. Handles the `loading` state by rendering nothing until session resolves.

### 🔴 Global error boundary
**Where:** `app/error.tsx`
**What happens:** Next.js error boundary catches unexpected crashes and shows a "Something went wrong" page with a "Try again" button that calls `reset()` to re-render the page.

### 🔴 Loading states everywhere
**Where:** Every page
**What happens:** Every data-fetching page has a loading state with a spinner and descriptive text. Examples: "Loading your cart...", "Loading menu...", "Loading checkout...", "Searching...", "Saving...". No blank screens.

### 🔴 Keyboard shortcut for search (`Cmd+K`)
**Where:** `app/(student)/browse/page.tsx`
**What happens:** A keyboard event listener catches `Cmd+K` / `Ctrl+K` and focuses the search input — a UX touch expected by power users.
```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      searchRef.current?.focus();
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);
```

---

## 9. Database & Data Integrity Edge Cases

### 🔴 Price changes don't affect historical orders
**Where:** Prisma schema — `OrderItem.unitPrice`
**What happens:** The `unitPrice` on `OrderItem` is a snapshot of the price at the time of order. If a vendor changes their menu item price later, all historical orders still reflect the correct amount charged. This prevents accounting discrepancies.
```prisma
model OrderItem {
  unitPrice  Decimal  @map("unit_price")  // Price at TIME OF ORDER — critical
}
```

### 🔴 Unique constraint on `razorpayOrderId` prevents double-processing
**Where:** Prisma schema — `Payment.razorpayOrderId` with `@unique`
**What happens:** Even if the webhook (or some retry mechanism) tries to create a duplicate Payment for the same Razorpay order, the unique constraint prevents it. This is a database-level safety net on top of the application-level checks.

### 🔴 Unique constraint on `razorpayPaymentId` prevents double-crediting
**Where:** Prisma schema — `Payment.razorpayPaymentId` with `@unique`
**What happens:** If Razorpay somehow sends the same payment ID in a webhook twice, the database prevents creating two payment records or updating two different orders with the same payment.

### 🔴 Composite unique on CartItem prevents duplicate entries
**Where:** Prisma schema — `@@unique([userId, menuItemId])`
**What happens:** A user can only have one row per menu item in their cart. Adding the same item again just increments the quantity. This is enforced at both application and database levels.

### 🔴 Cascade deletes prevent orphan records
**Where:** Prisma schema — `onDelete: Cascade`
**What happens:** If an order is deleted, its order items are cascade-deleted. If a user is deleted, their cart items and sessions are cascade-deleted. This prevents orphan records from accumulating.
```prisma
model OrderItem {
  order    Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
}
```

### 🔴 One user can only own one vendor shop
**Where:** Prisma schema — `Vendor.ownerId` with `@unique`
**What happens:** The `ownerId` on Vendor has a unique constraint, meaning each User can own exactly one vendor shop. This simplifies permission management and prevents a single user from creating multiple shops.

### 🔴 Composite index on OTP table for fast lookups
**Where:** Prisma schema — `@@index([target, type])`
**What happens:** The OTP table has a composite index on `(target, type)` for fast lookups during verification, preventing slow queries under load.

---

## 10. Summary — The Interview-Ready Answer

If an interviewer asks **"What edge cases did you handle?"**, here's your concise answer:

> **"We handled edge cases at every layer of the application.**
>
> **At the database level**, we have unique constraints (razorpay IDs, vendor owner), cascade deletes, and composite keys to prevent data corruption.
>
> **At the API level**, every route validates authentication, authorization, roles, and input schemas before processing — plus rate limiting prevents abuse at 5 different thresholds.
>
> **At the business logic level**, we have a validated order state machine that prevents invalid status transitions, atomic Prisma `$transaction` for order placement and payment confirmation, and HMAC-SHA256 signature verification on Razorpay webhooks to prevent fake payment confirmations.
>
> **At the UX level**, we handle loading, empty, error, and edge states for every component — empty carts, no orders, closed shops, pending approvals, expired OTPs, and failed payments all get their own dedicated UI. Nothing falls through the cracks."

---

## Bonus: Complete Valid State Transitions Diagram

```
PLACED ──→ CONFIRMED ──→ PREPARING ──→ READY ──→ PICKED_UP
   │           │             │           │
   └──→ CANCELLED ←──┴──────────┴──────────┘
```

**Allowed transitions per state:**
- PLACED    → CONFIRMED or CANCELLED
- CONFIRMED → PREPARING or CANCELLED
- PREPARING → READY or CANCELLED
- READY     → PICKED_UP or CANCELLED
- PICKED_UP → (terminal state, no further transitions)
- CANCELLED → (terminal state, no further transitions)

---

*MessLess · Made by Thapar, for Thapar*
*GitHub: github.com/sohamsachdeva/messless*
