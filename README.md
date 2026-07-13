# MessLess 🍽️

> **Campus food, delivered smarter.**  
> A full-stack, role-based campus food ordering platform built for Thapar Institute of Engineering & Technology.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)
![Neon](https://img.shields.io/badge/Neon-PostgreSQL-00E59B?logo=neon)
![Razorpay](https://img.shields.io/badge/Razorpay-Payments-02042B?logo=razorpay)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
  - [👨‍🎓 Students](#-students)
  - [👨‍🍳 Vendors](#-vendors)
  - [🛡️ Admins](#%EF%B8%8F-admins)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Seed Data](#seed-data)
- [Project Structure](#project-structure)
- [Role-Based Access](#role-based-access)
- [API Routes](#api-routes)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

MessLess is a **multi-vendor campus food ordering platform** that lets students browse cafeterias (hubs), place advance orders, and pay online — all without standing in line. Vendors get a dedicated dashboard to manage their menu and orders. Admins oversee the entire ecosystem.

The platform is built with **three distinct dashboards** governed by role-based access control:

| Role     | Access                                 |
| -------- | --------------------------------------- |
| Student  | Browse hubs, cart, checkout, order history |
| Vendor   | Dashboard, menu management, order mgmt   |
| Admin    | Dashboard, vendor approval, menu audit, analytics |

---

## Features

### 👨‍🎓 Students

- **Browse by Hubs** — Explore campus food courts (COS, Aahar, G Block, Jaggis, etc.)
- **Real-time Menus** — View vendor menus with item types (Veg / Non-Veg / Beverage / Snack)
- **Cart** — Add items, adjust quantities, checkout in a few taps
- **Multi-mode Ordering** — Delivery, Dine-in, or Takeaway
- **Online Payments** — Powered by Razorpay (UPI, Cards, Netbanking, Wallet)
- **Order Tracking** — Real-time status: Placed → Confirmed → Preparing → Ready → Picked Up / Delivered
- **Demo Mode** — Skip OTPs and payments for testing

### 👨‍🍳 Vendors

- **Dashboard** — Key metrics, recent orders, and quick actions at a glance
- **Menu Management** — Add, edit, delete menu items with prices, descriptions, categories
- **Order Management** — View incoming orders, update status, mark as ready
- **Operating Hours** — Set open/close times per vendor
- **Service Modes** — Toggle delivery, dine-in, and takeaway options

### 🛡️ Admins

- **Analytics Dashboard** — Total orders, revenue, user growth, vendor performance
- **Vendor Management** — Approve/reject/suspend vendor accounts
- **Menu Moderation** — Review and approve/reject menu items with admin notes
- **System Stats** — Insights into the entire platform

---

## Tech Stack

| Layer       | Technology                                                              |
| ----------- | ----------------------------------------------------------------------- |
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack)             |
| **Language**  | TypeScript                                                            |
| **Styling**   | Tailwind CSS 3 + CSS Variables (dark mode)                            |
| **Auth**      | NextAuth.js (Google OAuth + Credentials)                              |
| **Database**  | [Neon Serverless Postgres](https://neon.tech/)                        |
| **ORM**       | [Prisma 5](https://prisma.io/) with driver adapters                   |
| **Payments**  | [Razorpay](https://razorpay.com/)                                     |
| **Forms**     | Zod (validation)                                                      |
| **Icons**     | Lucide React                                                          |
| **Email**     | Nodemailer (Gmail SMTP)                                               |
| **SMS**       | MSG91                                                                 |
| **Hosting**   | Vercel                                                                |

---

## Architecture

```
┌─────────────────────┐
│    Next.js App      │
│  (App Router, RSC)  │
├─────────────────────┤
│  Student / Vendor   │
│  / Admin Pages      │
├─────────────────────┤
│  API Routes         │
│  (Edge / Serverless)│
├─────────────────────┤
│  NextAuth.js        │
│  (JWT Strategy)     │
├─────────┬───────────┤
│ Prisma  │ Razorpay  │
│ ORM     │ Payments  │
├─────────┴───────────┤
│  Neon PostgreSQL    │
└─────────────────────┘
```

### Data Model (Core)

- **User** — Single table for all roles (Student, Vendor, Admin, Faculty)
- **Hub** — Physical food court zones on campus
- **Vendor** — Cafeterias/stalls, linked to a Hub and owned by a User
- **MenuItem** — Individual items with pricing, category, approval status
- **CartItem** — Temporary cart entries per user
- **Order** — Full order lifecycle with status tracking
- **OrderItem** — Snapshot of items + prices at order time
- **Payment** — Razorpay integration with webhook verification
- **OTP** — Email/phone verification codes

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [npm](https://npmjs.com/)
- A [Neon](https://neon.tech/) PostgreSQL database
- Razorpay test/live account
- Google OAuth credentials

### Installation

```bash
# Clone the repo
git clone https://github.com/your-username/thapar-commerce.git
cd thapar-commerce

# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local
```

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# ── Database ───────────────────────────────────────
DATABASE_URL="postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require"

# ── NextAuth ───────────────────────────────────────
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"

# ── Google OAuth ────────────────────────────────────
GOOGLE_CLIENT_ID="xxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# ── Razorpay Payments ──────────────────────────────
RAZORPAY_KEY_ID="rzp_test_xxxx"
RAZORPAY_KEY_SECRET="your-razorpay-secret"

# ── Email (Gmail SMTP) ─────────────────────────────
SMTP_EMAIL="your-email@gmail.com"
SMTP_PASSWORD="your-gmail-app-password"

# ── SMS (MSG91, optional) ─────────────────────────
MSG91_API_KEY="your-msg91-api-key"
MSG91_SENDER_ID="MSLESS"
MSG91_TEMPLATE_ID="your-template-id"

# ── Demo Mode (optional) ───────────────────────────
NEXT_PUBLIC_DEMO_MODE="false"
```

### Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Or push schema directly (dev only)
npm run db:push
```

### Seed Data

You can optionally seed the database with sample hubs and admin credentials:

```bash
npm run db:seed
```

Then start the dev server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) 🚀

---

## Project Structure

```
thapar-commerce/
├── app/
│   ├── (auth)/          # Login, register, forgot/reset password
│   ├── (student)/       # Browse, cart, checkout, orders, hub pages
│   ├── admin/           # Admin dashboard, vendors, menu, analytics
│   ├── vendor/          # Vendor dashboard, menu mgmt, orders
│   ├── api/             # All API route handlers
│   ├── layout.tsx       # Root layout with providers
│   └── page.tsx         # Root redirect (login or role-based dashboard)
├── components/
│   ├── providers/       # ThemeProvider, SessionProvider
│   └── shared/          # Navbar, OTPInput, RoleGuard, ThemeToggle
├── lib/
│   ├── auth.ts          # NextAuth configuration
│   ├── prisma.ts        # Prisma client singleton
│   ├── razorpay.ts      # Razorpay instance + utilities
│   ├── otp.ts           # OTP generation, email/SMS sending
│   ├── validators.ts    # Zod schemas
│   └── constants.ts     # Platform fees & constants
├── prisma/
│   ├── schema.prisma    # Database schema
│   ├── migrations/      # Prisma migrations
│   └── seed.ts          # Seed script
├── middleware.ts        # Route protection middleware
├── types/               # TypeScript type definitions
└── scripts/             # Utility scripts
```

---

## Role-Based Access

Route protection is enforced at two levels:

1. **Middleware** (`middleware.ts`) — Protects route groups:
   - `/browse`, `/cart`, `/checkout`, `/orders`, `/hub` → any authenticated user
   - `/vendor/dashboard`, `/vendor/menu`, `/vendor/orders` → VENDOR or ADMIN
   - `/admin/*` → ADMIN only

2. **Components** (`RoleGuard`) — Fine-grained UI-level access control

### Auth Flow

- **Students** — Login with `@thapar.edu` email (Google OAuth or credentials)
- **Vendors** — Login with phone number + password (credentials only)
- **Admins** — Login with `@thapar.edu` email (can be promoted via DB)

---

## API Routes

All API routes are under `app/api/`:

| Route Group      | Endpoints                        | Description                     |
| ---------------- | -------------------------------- | ------------------------------- |
| `/api/auth/*`    | register, send-otp, verify-otp   | Registration & OTP verification |
| `/api/cart/*`    | cart CRUD                        | Cart management                 |
| `/api/orders/*`  | order CRUD                       | Order lifecycle                 |
| `/api/hubs/*`    | hub CRUD                         | Food court hubs                 |
| `/api/vendors/*` | vendor details                   | Public vendor info              |
| `/api/vendor/*`  | dashboard, menu-items, orders    | Vendor-specific operations      |
| `/api/admin/*`   | stats, vendors, menu-items       | Admin operations                |
| `/api/razorpay/*`| create-order, webhook            | Payment processing              |
| `/api/search`    | search                           | Menu/hub search                 |
| `/api/demo/*`    | advance-order                    | Demo-only endpoints             |

---

## Deployment

The app is ready to deploy on Vercel. Required environment variables must be set in the Vercel dashboard.

```bash
# Build command (set in Vercel)
prisma generate && next build
```

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Make sure to add all environment variables from [Environment Variables](#environment-variables) in your Vercel project settings.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feat/amazing-feature`
5. Open a Pull Request

Please follow the existing code conventions and ensure your changes pass linting:

```bash
npm run lint
```

---

## License

This project is developed for Thapar Institute of Engineering & Technology. All rights reserved.

---

<p align="center">
  Made with ❤️ by the Thapar student developer community
</p>
