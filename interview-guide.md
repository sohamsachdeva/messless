# 🎓 MessLess — Complete Interview Preparation Guide

> Full-Stack Campus Food Ordering Platform | Thapar Institute of Engineering & Technology

---

## 1. Project Overview — "What did you build?"

**"MessLess is a full-stack, multi-vendor campus food ordering platform built for Thapar Institute of Engineering & Technology. Think of it as Swiggy or Zomato but exclusively for a university campus."**

The problem: Students at Thapar have 4 food hubs on campus (COS, Aahar, G Block, Jaggis) with ~10 vendors total. During peak hours, there are long queues. The solution lets students:

- Browse food hubs and their vendors
- Pre-order meals for takeaway, dine-in, or delivery
- Pay online via Razorpay (UPI, cards, netbanking)
- Track order status in real-time (Placed → Confirmed → Preparing → Ready → Picked Up)

It's built with three role-specific dashboards — **Student, Vendor, Admin** — with full role-based access control.

| Role | Accesses |
|---|---|
| **Student** | Browse hubs, vendor menus, cart, checkout, pay, track orders |
| **Vendor** | Dashboard (revenue/orders), manage menu items, update order status |
| **Admin** | Approve/reject vendors, approve/reject menu items, platform analytics |

---

## 2. Tech Stack — "Why did you choose these technologies?"

*This is a classic interview question. Have a clear "why" for each choice.*

| Technology | Interview Answer |
|---|---|
| **Next.js 16 (App Router)** | "Next.js gives me a full-stack app in a single codebase — file-based routing, API routes, server components, and middleware for auth. Deploys seamlessly on Vercel with zero config." |
| **TypeScript** | "Type safety across the full stack. The data model has complex relationships (User→Vendor→MenuItem→Order→Payment) and TypeScript catches mismatches at compile time." |
| **Neon (Serverless Postgres)** | "PostgreSQL-compatible but serverless — scales to zero when unused, perfect for a college project. The `@prisma/adapter-neon` uses WebSocket instead of TCP, eliminating the 20-30 second cold start from traditional Postgres on serverless." |
| **Prisma 5** | "Type-safe, auto-generated database client. The schema file is the single source of truth — define models once, Prisma generates both TypeScript types and SQL migrations." |
| **NextAuth.js (JWT)** | "Handles session complexity out of the box. JWT strategy means no session store needed for serverless. Two providers: credentials (email/phone) + Google OAuth." |
| **Razorpay** | "Built for the Indian market — supports UPI, cards, netbanking. Great checkout UX. Webhook-based payment verification with HMAC signatures prevents fraud." |
| **Tailwind CSS** | "Utility-first CSS for rapid UI development. Dark mode via CSS variables and `class` strategy keeps theming consistent across the app." |
| **Zod** | "Shared validation schemas between frontend forms and API routes — one source of truth so validation rules never drift apart." |
| **Nodemailer (Gmail SMTP)** | "For sending OTP emails (email verification, password reset). No external email service needed during development." |
| **MSG91** | "Indian SMS gateway for sending OTPs to vendor phone numbers during registration." |

---

## 3. Database Schema — The 10 Tables

**"Our database has 10 tables connected through Prisma ORM on Neon Postgres."**

### Entity Relationships

```
Hub (1) ────< Vendor (M)    → Food court zones containing multiple vendors
User (1) ───< Vendor (1)    → Each user can own exactly one vendor shop (VENDOR role)
User (1) ───< Order (M)     → Students place many orders
User (1) ───< CartItem (M)  → Temporary cart per user
Vendor (1) ──< MenuItem (M) → Each vendor has many menu items
Vendor (1) ──< Order (M)    → Each vendor receives many orders
Order (1) ───< OrderItem (M)→ Junction table with price snapshots (critical!)
Order (1) ───< Payment (1)  → One-to-one with Razorpay details
OTP          → Standalone for email/phone verification
Session      → NextAuth session management
```

### Enums (Used across models)

- **Role:** STUDENT, FACULTY, VENDOR, ADMIN
- **VendorCategory:** FOOD, BEVERAGES, OTHER
- **ItemType:** VEG, NON_VEG, BEVERAGE, SNACK, OTHER
- **OrderStatus:** PLACED, CONFIRMED, PREPARING, READY, PICKED_UP, DELIVERED, CANCELLED
- **PaymentStatus:** PENDING, SUCCESS, FAILED, REFUNDED
- **ApprovalStatus:** PENDING, APPROVED, REJECTED

### 5 Key Design Decisions (Impressive to Mention)

**1. Price Snapshot on OrderItem (not MenuItem)**
> "We store `unitPrice` on each `OrderItem` at order time rather than always reading from `MenuItem.price`. This means historical orders always reflect what was actually charged, even if the vendor changes prices later. Critical for accounting and dispute resolution."

**2. Single-Vendor Cart Enforcement**
> "A student can only have items from one vendor in their cart at a time. Enforced in the API (not DB constraint) — adding from a different vendor returns a 409 Conflict asking to clear the cart first."

**3. Admin Approval Workflow (Two Levels)**
> "Vendors need admin approval before going live. Menu items need admin approval before appearing on the menu. Each MenuItem has `approvalStatus` (PENDING | APPROVED | REJECTED) and `adminNote` for rejection reasons. This ensures quality control."

**4. Order Status State Machine**
> "Order transitions are validated server-side with a whitelist of allowed transitions. Cancellation is only allowed up to the PREPARING step — once the vendor starts cooking, it can't be cancelled."

```typescript
const VALID_TRANSITIONS = {
  PLACED:    ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY:     ["PICKED_UP", "CANCELLED"],
  PICKED_UP: [],
  CANCELLED: [],
};
```

**5. Atomic Payment + Order Update**
> "The Razorpay webhook handler wraps the payment status update and order status update in a single Prisma `$transaction`. If either fails, both roll back — so we never have a paid order stuck in 'PLACED' or an unpaid order marked 'CONFIRMED'."

---

## 4. Authentication & Authorization

**"We use NextAuth.js with JWT strategy and two authentication providers."**

### Auth Flow

| User Type | Login Method | Constraints |
|---|---|---|
| **Student** | Google OAuth OR Email + Password | Must use `@thapar.edu` email. Google auto-creates account on first login. |
| **Vendor** | Phone + Password only | Indian phone numbers (starting with 6-9). Must be approved by admin after registration. |
| **Admin** | Google OAuth OR Email + Password | Same `@thapar.edu` constraint. Role promoted via DB seed. |

### ⚡ Role-Based Access (2 Layers)

**Layer 1 — Middleware** (`middleware.ts` with `withAuth`):
- `/browse`, `/cart`, `/checkout`, `/orders`, `/hub` → any authenticated user
- `/vendor/dashboard`, `/vendor/menu`, `/vendor/orders` → VENDOR or ADMIN only
- `/admin/*` → ADMIN only
- *(Note: `/vendor/[id]` is the student-facing menu page and is NOT middleware-protected)*

**Layer 2 — JWT Callbacks** (`lib/auth.ts`):
- The `jwt` callback attaches `role`, `id`, and `thaparId` to the JWT token on login
- The `session` callback exposes these to the client-side session
- On token refresh (subsequent requests), the role is re-synced from DB to catch any role changes

### Security Measures

- Passwords hashed with **bcrypt, salt rounds = 12**
- OTPs limited to **5 attempts** before auto-deletion
- Rate limiting on all API routes (sliding window, in-memory)
- `ownerId` is **unique** on Vendor — one user, one shop
- Google signIn callback blocks non-`@thapar.edu` emails
- OTP rate limit: 1 minute minimum gap between resends

---

## 5. The 4 Main User Flows (Walkthrough)

### Flow 1: Student Ordering

```
Login → /browse (hubs page, Swiggy-style)
  → Click a hub (e.g. COS) → /hub/[hubId]
    → See vendor cards with open/closed status, hours, service modes
    → Click a vendor (e.g. WrapChik) → /vendor/[id]
      → Browse menu items grouped by type (Veg, Non-Veg, Beverage)
      → Items show: veg/non-veg dot, price, popularity badge, description
      → Click "Add" → quantity increments in local React state
      → Select order mode: Takeaway / Dine In / Delivery
      → Click floating "Go to Cart" bar
        → POST saves cart items to DB (clears previous cart first)
        → Redirects to /cart
      → /cart: view items, adjust qty, add note, see bill summary
      → "Proceed to Pay"
        → POST /api/orders → creates Order in DB (clears cart atomically)
        → Redirect to /checkout
      → /checkout: Payment method (UPI / NetBanking)
        → POST /api/razorpay/create-order → Razorpay order created
        → Opens Razorpay checkout modal
        → User pays → webhook verifies → order CONFIRMED
        → Success page → "Track my order"
```

### Flow 2: Vendor Dashboard

```
Login with phone → /vendor/dashboard
  → Header: Shop name, location, phone
  → Stats cards: Today's Revenue, Today's Orders, Total Revenue, Live Items, Pending Approval
  → Quick actions: Manage Menu, View Orders
  → Recent Orders list (last 10)

Menu Management (/vendor/menu):
  → See items grouped: Live ✅ | Pending ⏳ | Rejected ❌
  → "Add item" form: name, price, description, type (Veg/Non-Veg/Beverage/Other)
  → Item goes to PENDING approval
  → Admin approves → item becomes Live
  → Toggle availability switch for live items (hide/show on student menu)

Orders (/vendor/orders):
  → Paginated list with filters: Active / Completed / All
  → Each order shows: student name, items, total, time, payment status
  → Click to update status (state machine validated)
  → Auto-refreshes every 30 seconds
```

### Flow 3: Admin Panel

```
Login with admin@thapar.edu → /admin/dashboard
  → Stats cards with "Urgency" badges:
    → Pending vendor approvals (amber badge if > 0)
    → Pending menu items (blue badge if > 0)
    → Total vendors, Total orders, Registered students
  → Quick action buttons: Review Vendors, Review Menu Items

Admin Vendors (/admin/vendors):
  → Table of all vendors with approval status
  → Approve / Reject / Suspend

Admin Menu Items (/admin/menu-items):
  → All items across all vendors
  → Approve / Reject with admin note
```

### Flow 4: Vendor Registration

```
Login page → Switch to "Vendor" tab
  → "Register your shop" link
  → Step 1 - Form:
    → Enter: Shop name, Phone number, Password, Confirm password
    → Admin approval notice shown
    → Click "Send verification OTP"
  → Step 2 - OTP:
    → Enter 6-digit phone OTP
    → Timer (10 min expiry), resend button
    → Click "Verify & submit registration"
  → Success screen:
    → "Your shop is pending admin approval"
    → Shows registered phone number for reference
  → Admin approves via /admin/vendors
  → Vendor can now login with phone + password
```

---

## 6. Payment Integration — The Most Technically Impressive Part

### Complete Checkout Flow

```
Cart Page → "Proceed to Pay"
  → POST /api/orders → Creates Order in DB (Prisma $transaction: creates order + clears cart)
  → Redirect to /checkout
  
/checkout page:
  → Fetches order by ID from sessionStorage
  → Shows: vendor info, order mode, items, bill summary (total + ₹5 platform fee)
  → Payment method selection (UPI / NetBanking)
  → "Pay" button:
    → POST /api/razorpay/create-order
      → Initializes Razorpay SDK
      → Creates Razorpay order (amount × 100 for paise)
      → Upserts Payment record with razorpayOrderId
      → Returns order details to frontend
    → Loads checkout.js script dynamically
    → Opens Razorpay modal with key, amount, prefill data
    
After payment:
  → On success → POST /api/razorpay/webhook
    → HMAC-SHA256 signature verification (prevents fake webhooks)
    → Prisma $transaction: Payment → SUCCESS + Order → CONFIRMED
  → Redirect to success page with "Track my order" button
  
  → On failure → Error state with retry option
  → On modal dismiss → "Payment cancelled, try again"
```

### Key Security Features

- **HMAC-SHA256 verification** in webhook: `crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(orderId + "|" + paymentId).digest("hex")`
- **Atomic Prisma $transaction** — payment and order status updates are atomic
- **Order ownership check** — only the order owner can initiate payment
- **Unique constraints** on `razorpayOrderId` and `razorpayPaymentId` prevent duplicate processing

---

## 7. Rate Limiting — Sliding Window (No Redis!)

"We implemented in-memory sliding window rate limiting for all API routes. Different route categories get different limits:"

| Route Category | Limit | Purpose |
|---|---|---|
| Auth routes | 10 req / 10s | Prevents brute-force attacks on login/register |
| General API | 60 req / 60s | Browsing hubs, search, menu viewing |
| Admin routes | 30 req / 60s | Sensitive admin endpoints |
| Cart & Orders | 30 req / 60s | Write-heavy operations |
| Payments | 100 req / 60s | Allows webhook retries from Razorpay |

**Interview talking point:** "For a college project, adding Redis just for rate limiting felt like over-engineering. The in-memory sliding window is per-process and resets on restart, but it's more than adequate for our traffic and keeps the infrastructure simple. If we needed to scale to multiple instances, we'd swap in Upstash Redis with zero code changes since our limiter interface is abstracted."

---

## 8. OTP System — Email + SMS

**Talking point for interviews:**

"OTPs are stored in the database with a 10-minute expiry, max 5 incorrect attempts, and a 1-minute rate limit between resends. In development and demo mode (`NEXT_PUBLIC_DEMO_MODE=true`), the OTP is always '123456' so we don't need actual SMS credits during testing. In production, it's a random 6-digit code sent via Gmail SMTP for email or MSG91 REST API for SMS."

Key features:
- **Rate limit check** before creating new OTP (prevents spam)
- **Max 5 attempts** — OTP auto-deletes after 5 wrong tries
- **Dev mode** — always uses "123456" for convenience
- **Graceful fallback** — if SMTP not configured, OTP is logged to console

---

## 9. Project Folder Structure

```
thapar-commerce/
├── app/                              ← Next.js App Router
│   ├── (auth)/                       ← Route group: login, register, forgot-password
│   │   ├── login/page.tsx           ← Student + Vendor login (with OTP register flow)
│   │   ├── register/page.tsx        ← Student registration with email OTP
│   │   ├── forgot-password/page.tsx ← Password reset flow
│   │   └── layout.tsx               ← Auth layout wrapper
│   │
│   ├── (student)/                    ← Route group: student-facing pages
│   │   ├── browse/page.tsx          ← Swiggy-style hub browsing with search + filters
│   │   ├── hub/[hubId]/page.tsx     ← Single hub detail with vendor cards
│   │   ├── vendor/[id]/page.tsx     ← Vendor menu (add to cart interface)
│   │   ├── cart/page.tsx            ← Cart with qty, note, bill, order mode
│   │   ├── checkout/page.tsx        ← Payment with Razorpay modal
│   │   ├── orders/page.tsx          ← Order history with filters
│   │   ├── orders/[id]/page.tsx     ← Single order tracking
│   │   └── layout.tsx               ← Student layout wrapper
│   │
│   ├── admin/                        ← Admin dashboard
│   │   ├── dashboard/page.tsx       ← Stats overview with action cards
│   │   ├── vendors/page.tsx         ← Approve/reject vendors
│   │   ├── menu-items/page.tsx      ← Approve/reject menu items
│   │   ├── analytics/page.tsx       ← Platform analytics
│   │   └── layout.tsx               ← Admin layout wrapper
│   │
│   ├── vendor/                       ← Vendor dashboard
│   │   ├── dashboard/page.tsx       ← Revenue, orders, recent activity
│   │   ├── menu/page.tsx            ← CRUD menu items (with approval flow)
│   │   ├── orders/page.tsx          ← Incoming orders with status management
│   │   └── layout.tsx               ← Vendor layout wrapper
│   │
│   ├── api/                          ← All API route handlers
│   │   ├── auth/                    ← register, send-otp, verify-otp, vendor-register, reset-password
│   │   ├── cart/                    ← GET/POST/DELETE cart, PATCH/DELETE cart items
│   │   ├── orders/                  ← GET order history, POST place order, GET single order
│   │   ├── hubs/                    ← GET all hubs, GET hub by id
│   │   ├── vendors/                 ← GET vendor details with menu
│   │   ├── search/                  ← GET search vendors/hubs
│   │   ├── razorpay/                ← POST create-order, POST webhook
│   │   ├── vendor/                  ← dashboard, menu-items, orders
│   │   ├── admin/                   ← stats, vendors, menu-items
│   │   └── keep-alive/             ← Prevents Neon DB from sleeping
│   │
│   ├── layout.tsx                   ← Root layout (SessionProvider + ThemeProvider)
│   ├── page.tsx                     ← Root redirect (login or role-based dashboard)
│   ├── middleware.ts                ← Route protection (withAuth)
│   ├── error.tsx                   ← Global error boundary
│   ├── loading.tsx                  ← Suspense fallback
│   ├── not-found.tsx               ← 404 page
│   └── globals.css                 ← CSS variables for theming
│
├── components/
│   ├── providers/                   ← ThemeProvider, ThemeColorMeta
│   └── shared/                      ← Navbar, OTPInput, RoleGuard, SessionProvider, ThemeToggle
│
├── lib/                             ← Core libraries
│   ├── auth.ts                     ← NextAuth config (Google + credentials, JWT callbacks)
│   ├── prisma.ts                   ← Prisma client singleton (Neon adapter)
│   ├── razorpay.ts                 ← Razorpay instance + HMAC verification
│   ├── otp.ts                      ← OTP generation, send email/SMS, verify
│   ├── validators.ts              ← Zod schemas for all API inputs
│   ├── rateLimiter.ts             ← Sliding window rate limiters
│   ├── rateLimiterMemory.ts       ← In-memory sliding window implementation
│   └── constants.ts               ← Platform fee (₹5)
│
├── prisma/
│   ├── schema.prisma               ← Database schema (10 models, 9 enums)
│   ├── migrations/                  ← Migration history
│   └── seed.ts                     ← Seeds 4 hubs, 10 vendors, 45+ menu items
│
├── types/                          ← Shared TypeScript types
│   └── index.ts                    ← API response types, cart/order types
│
├── middleware.ts                   ← NextAuth route protection
├── tailwind.config.js              ← Theme colors: primary (#9B1B1B), fonts
└── README.md                       ← Project documentation
```

---

## 10. API Route Summary

| Route | Method | What It Does | Auth Required |
|---|---|---|---|
| `/api/auth/register` | POST | Create student account (must have verified OTP) | Public |
| `/api/auth/vendor-register` | POST | Create vendor account + pending vendor record | Public |
| `/api/auth/send-otp` | POST | Send OTP to email or phone | Public |
| `/api/auth/verify-otp` | POST | Verify OTP code | Public |
| `/api/auth/reset-password` | POST | Reset password after OTP verification | Public |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth handler | Public |
| `/api/hubs` | GET | List all hubs with vendor count | Auth |
| `/api/hubs/[id]` | GET | Hub details + all vendors | Auth |
| `/api/vendors/[id]` | GET | Vendor details + full menu | Auth |
| `/api/search` | GET | Full-text search (vendors + hubs + menu items) | Auth |
| `/api/cart` | GET | Fetch current user's cart | Auth |
| `/api/cart` | POST | Add item to cart (single-vendor enforcement) | Auth |
| `/api/cart` | DELETE | Clear entire cart | Auth |
| `/api/cart/[itemId]` | PATCH | Update item quantity | Auth |
| `/api/cart/[itemId]` | DELETE | Remove item from cart | Auth |
| `/api/orders` | GET | User's order history | Auth |
| `/api/orders` | POST | Place order (transactional: create order + clear cart) | Auth |
| `/api/orders/[orderId]` | GET | Single order details (ownership check) | Auth |
| `/api/razorpay/create-order` | POST | Create Razorpay order + save Payment record | Auth |
| `/api/razorpay/webhook` | POST | HMAC verify + atomic payment+order update | Webhook |
| `/api/vendor/dashboard` | GET | Vendor stats dashboard data | VENDOR |
| `/api/vendor/menu-items` | GET | List vendor's menu items | VENDOR |
| `/api/vendor/menu-items` | POST | Submit new item for admin approval | VENDOR |
| `/api/vendor/menu-items/[itemId]` | PATCH | Toggle availability / update item | VENDOR |
| `/api/vendor/orders` | GET | Paginated orders with filters | VENDOR |
| `/api/vendor/orders` | PATCH | Update order status (state machine) | VENDOR |
| `/api/admin/stats` | GET | Platform statistics (pending, totals) | ADMIN |
| `/api/admin/vendors` | GET | All vendors with owner/hub info | ADMIN |
| `/api/admin/vendors/[vendorId]` | PATCH | Approve/reject/suspend vendor | ADMIN |
| `/api/admin/menu-items` | GET | All menu items across all vendors | ADMIN |
| `/api/admin/menu-items/[itemId]` | PATCH | Approve/reject menu item | ADMIN |

---

## 11. Important Design Decisions & Tradeoffs (Interview Gold)

### Decision 1: Price Snapshot Pattern
> "When an order is placed, we store `unitPrice` on each `OrderItem` instead of always reading from `MenuItem.price`. This means historical orders always reflect what was actually charged, even if the vendor changes prices later."

### Decision 2: Atomic Payment Verification
> "The Razorpay webhook handler wraps payment status update + order status update in a single Prisma `$transaction`. If either fails, both roll back — so we never have a paid order stuck in 'PLACED' or an unpaid order marked 'CONFIRMED'."

### Decision 3: Rate Limiting Without Redis
> "For a college project, adding Redis just for rate limiting felt like over-engineering. We implemented a sliding window counter in memory — it's per-process and resets on restart, but more than adequate for our traffic and keeps the infrastructure simple."

### Decision 4: Inline CSS + CSS Variables (not Tailwind everywhere)
> "Some parts of the app use inline styles and CSS variables for dynamic theming (e.g., vendor card gradients, dark mode colors). This gives us flexibility that utility classes alone can't easily achieve — like gradient backgrounds that change per-vendor."

### Decision 5: Demo Mode Flag
> "The `NEXT_PUBLIC_DEMO_MODE` environment variable switches the app to demo mode — OTPs are always '123456', payments skip Razorpay and redirect to a mock payment page. This makes it easy to demo the full flow without real credentials."

---

## 12. Potential Interview Questions & Answers

| Question | Answer |
|---|---|
| **"How do you handle concurrent payments?"** | "Razorpay's webhook system with HMAC verification ensures payment integrity. We use Prisma `$transaction` for atomic updates — if the webhook is called twice, the second call finds the payment already marked SUCCESS and skips processing. We also have unique constraints on `razorpayOrderId` and `razorpayPaymentId`." |
| **"What would you improve?"** | "I'd add real-time order updates using WebSockets or Server-Sent Events so the vendor dashboard updates instantly instead of polling every 30 seconds. I'd also add push notifications via Firebase Cloud Messaging when orders are ready. And I'd add a review/rating system for completed orders." |
| **"How would you scale this?"** | "The in-memory rate limiter would need Redis for multi-instance deployment. The cart could be moved to Redis for persistence across sessions. Neon can scale with connection pooling. For image uploads, we'd use Cloudinary or S3. The Next.js API routes are already serverless-ready on Vercel's edge network." |
| **"How do you ensure type safety?"** | "Prisma generates TypeScript types from the schema. Zod schemas validate API inputs on both client and server. NextAuth JWT callbacks attach role and ID to the session type. Shared types in `types/index.ts` ensure consistency between frontend and backend." |
| **"How does the dev experience work?"** | "`npm run dev` starts the Next.js dev server with Turbopack for fast HMR. Prisma Studio gives us a GUI to inspect the database. The seed script populates 4 hubs, 10 vendors, and 45+ menu items. OTPs are always '123456' in dev mode. The demo mode flag skips real payments." |
| **"How is the vendor registration flow different from student?"** | "Students register with their `@thapar.edu` email and can log in immediately. Vendors register with a phone number and must wait for admin approval — their account is created with `isApproved: false` and they can't log in until an admin approves them via the admin panel." |
| **"Why the order status state machine?"** | "It prevents invalid transitions — e.g., a vendor can't mark an order as 'Picked Up' directly from 'Placed'. This ensures consistent order tracking and prevents operational errors. The valid transitions are defined in a single constant object, making it easy to audit and modify." |
| **"How is the cart single-vendor restriction enforced?"** | "When adding an item, we check if the cart already has items from a different vendor. If so, we return a 409 Conflict with code `DIFFERENT_VENDOR` and a message asking the user to clear their cart. This is application-level logic, not a DB constraint." |

---

## 13. Seeded Credentials (For Demo)

| Role | Shop | Identifier | Password |
|---|---|---|---|
| **Admin** | — | admin@thapar.edu | Messless@123 |
| **Student** | — | student@thapar.edu | Messless@123 |
| **Vendor** | WrapChik (COS) | 9876500101 | Messless@123 |
| **Vendor** | Dessert Club (COS) | 9876500102 | Messless@123 |
| **Vendor** | Iqbal Juice Corner (COS) | 9876500103 | Messless@123 |
| **Vendor** | Chaap Wala (Aahar) | 9876500201 | Messless@123 |
| **Vendor** | Aahar Food Point (Aahar) | 9876500202 | Messless@123 |
| **Vendor** | G Block Canteen (G Block) | 9876500301 | Messless@123 |
| **Vendor** | Campus Bites (G Block) | 9876500302 | Messless@123 |
| **Vendor** | Iqbal Juice Corner (Jaggis) | 9876500401 | Messless@123 |
| **Vendor** | Jaggi Bites (Jaggis) | 9876500402 | Messless@123 |

---

## 14. Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Razorpay
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="..."

# Email (Gmail SMTP)
SMTP_EMAIL="..."
SMTP_PASSWORD="..."     # Gmail App Password

# SMS (MSG91 - optional)
MSG91_API_KEY="..."
MSG91_SENDER_ID="MSLESS"
MSG91_TEMPLATE_ID="..."

# Demo mode (optional)
NEXT_PUBLIC_DEMO_MODE="false"
```

---

## 15. Summary — What Makes This Project Stand Out

> **"MessLess demonstrates a production-quality full-stack architecture with: Type-safe database access via Prisma, role-based authorization with NextAuth, real payment integration with Razorpay webhooks and HMAC verification, a validated order state machine, admin approval workflows, rate-limited APIs, and a responsive UI with dark mode — all running serverless on Vercel with Neon Postgres."**

The project shows you can:
- Architect a multi-role application from scratch
- Integrate third-party payment gateways securely
- Design normalized database schemas with real-world constraints
- Implement proper authentication and authorization
- Handle edge cases (concurrent payments, invalid state transitions, duplicate requests)
- Build production-quality UIs with modern tooling

---

*MessLess · Made by Thapar, for Thapar*  
*GitHub: github.com/sohamsachdeva/messless*
