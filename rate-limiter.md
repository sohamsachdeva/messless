# ⏱️ MessLess — In-Memory Sliding Window Rate Limiter

> Full-Stack Campus Food Ordering Platform | Thapar Institute of Engineering & Technology

---

## Table of Contents

- [The Architecture](#the-architecture)
- [How the Sliding Window Algorithm Works](#how-the-sliding-window-algorithm-works)
- [The 5 Rate Limiter Configurations](#the-5-rate-limiter-configurations)
- [How Each API Route Uses It](#how-each-api-route-uses-it)
- [Memory Management — Preventing Leaks](#memory-management--preventing-leaks)
- [Why In-Memory Instead of Redis?](#why-in-memory-instead-of-redis)
- [The Interview-Ready Answer](#the-interview-ready-answer)

---

## The Architecture

The rate limiter has two files working together:

1. **`lib/rateLimiterMemory.ts`** — The actual sliding window algorithm (a class called `InMemoryRatelimit`)
2. **`lib/rateLimiter.ts`** — Pre-configured rate limiter instances for different route categories + a `checkRateLimit()` helper

---

## How the Sliding Window Algorithm Works

### The Core Class

```typescript
export class InMemoryRatelimit {
  private timestamps: Map<string, number[]>;  // Maps user ID → array of timestamps
  private maxRequests: number;                  // Max requests allowed in the window
  private windowMs: number;                     // Window duration in milliseconds

  constructor(maxRequests: number, window: string) {
    this.timestamps = new Map();
    this.maxRequests = maxRequests;
    this.windowMs = parseWindow(window); // e.g., "10 s" → 10000ms, "60 s" → 60000ms
  }
```

### The `limit()` Method — The Heart of It

```typescript
async limit(identifier: string): Promise<{ success: boolean }> {
  const now = Date.now();
  const cutoff = now - this.windowMs;  // e.g., if window is 10s, cutoff = 10 seconds ago

  // Step 1: Get existing timestamps for this user
  let timestamps = this.timestamps.get(identifier) ?? [];

  // Step 2: REMOVE timestamps that are OUTSIDE the current window
  // (these are too old and should no longer count)
  timestamps = timestamps.filter((t) => t > cutoff);

  // Step 3: Check if the user has exceeded the limit
  if (timestamps.length >= this.maxRequests) {
    this.timestamps.set(identifier, timestamps);
    return { success: false };  // ← BLOCKED
  }

  // Step 4: Allow the request — add current timestamp
  timestamps.push(now);
  this.timestamps.set(identifier, timestamps);
  return { success: true };     // ← ALLOWED
}
```

### Concrete Example

Let's say we have `authRateLimit = new InMemoryRatelimit(10, "10 s")` — **10 requests per 10 seconds**.

```
A user makes requests at these times:
T=0s    → Request 1  → timestamps = [0]     → 1 < 10 → ✅ ALLOWED
T=3s    → Request 2  → timestamps = [0, 3]  → 2 < 10 → ✅ ALLOWED
T=7s    → Request 3  → timestamps = [0,3,7] → 3 < 10 → ✅ ALLOWED
...
T=9s    → Request 10 → timestamps = [0,3,7,9] → 10 >= 10 → ❌ BLOCKED
T=11s   → Request 11
         → cutoff = 11 - 10 = 1s
         → timestamps.filter(t > 1) → [3, 7, 9]  (0 got removed!)
         → 3 < 10 → ✅ ALLOWED (user gets a fresh slot!)
```

**This is the "sliding window" behavior:** The window isn't a fixed clock (e.g., "block from 0s to 10s") — it slides with time. As soon as a timestamp falls outside the window, the user gets a slot back. This is **more fair** than fixed-window rate limiting (which would block everyone at the same boundary).

### Visual: Fixed Window vs Sliding Window

```
Fixed Window (bad):
┌─────────────────┐
│  Requests 0-10s  │          ← Everyone resets at the same time
└─────────────────┘
┌─────────────────┐
│  Requests 10-20s │          ← Burst of traffic at the boundary
└─────────────────┘

Sliding Window (ours):
│   │   │   │   │   │   │
❌   ✅  ✅  ❌  ✅  ✅
│   │   │   │   │   │   │
0s  2s  4s  6s  8s  10s 12s

Each request checks against its own personalized 10-second window.
Much more granular and fair — no burst at boundaries.
```

---

## The 5 Rate Limiter Configurations

```typescript
export const authRateLimit    = new InMemoryRatelimit(10,  "10 s");  // 10 req/10s
export const apiRateLimit     = new InMemoryRatelimit(60,  "60 s");  // 60 req/60s
export const adminRateLimit   = new InMemoryRatelimit(30,  "60 s");  // 30 req/60s
export const orderRateLimit   = new InMemoryRatelimit(30,  "60 s");  // 30 req/60s
export const paymentRateLimit = new InMemoryRatelimit(100, "60 s");  // 100 req/60s
```

| Limiter | Limit | Where It's Used | Why This Limit |
|---|---|---|---|
| `authRateLimit` | 10 req / 10s | Login, register, forgot password, OTP | Brute-force protection — attackers can't rapidly try passwords |
| `apiRateLimit` | 60 req / 60s | Browse hubs, search, view menus | Normal browsing — a student scrolling through menus |
| `adminRateLimit` | 30 req / 60s | Admin dashboard, vendor/menu approvals | Sensitive admin operations — no need for high throughput |
| `orderRateLimit` | 30 req / 60s | Cart add/remove, place order | Write-heavy — prevents accidental double-clicks |
| `paymentRateLimit` | 100 req / 60s | Razorpay order creation, webhooks | Webhooks need room for retries from Razorpay |

---

## How Each API Route Uses It

Every API route has **two lines** at the top:

```typescript
export async function POST(req: NextRequest) {
  // ── Line 1: Check rate limit, return 429 if exceeded
  const rl = await checkRateLimit(authRateLimit, req);
  if (rl) return rl;  // ← If rate limited, return 429 immediately

  // ── Line 2: Rest of the handler
  const body = await req.json();
  // ... process normally ...
}
```

The `checkRateLimit` helper extracts the user's IP address:

```typescript
export async function checkRateLimit(limiter, req?) {
  const identifier = req
    ? (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??  // Real IP behind proxy
       req.headers.get("x-real-ip") ??                                // Direct IP
       "anonymous")                                                   // Fallback
    : "anonymous";

  const { success } = await limiter.limit(identifier);
  if (!success) return rateLimitResponse();
  return null;
}
```

### The 429 Response

When blocked, it returns a standard HTTP 429:

```typescript
export function rateLimitResponse(): Response {
  return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": "10",  // Tells the client when to retry
    },
  });
}
```

### Real usage across the codebase (every API route):

```typescript
// app/api/auth/register/route.ts
const rl = await checkRateLimit(authRateLimit, req);
if (rl) return rl;

// app/api/orders/route.ts
const rl = await checkRateLimit(orderRateLimit, req);
if (rl) return rl;

// app/api/razorpay/webhook/route.ts
const rl = await checkRateLimit(paymentRateLimit, req);
if (rl) return rl;

// app/api/admin/vendors/route.ts
const rl = await checkRateLimit(adminRateLimit, _req);
if (rl) return rl;

// app/api/hubs/route.ts
const rl = await checkRateLimit(apiRateLimit, _req);
if (rl) return rl;
```

---

## Memory Management — Preventing Leaks

The rate limiter has a **cleanup mechanism** to prevent the `Map` from growing unbounded:

```typescript
constructor(maxRequests, window) {
  // ... setup ...

  // Clean up stale entries every 60 seconds
  this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);

  // Don't block Node.js process from exiting
  if (this.cleanupInterval && typeof this.cleanupInterval === "object") {
    this.cleanupInterval.unref?.();
  }
}

private cleanup() {
  const cutoff = Date.now() - this.windowMs * 2;  // Delete entries older than 2× window
  for (const [key, timestamps] of this.timestamps.entries()) {
    const recent = timestamps.filter((t) => t > cutoff);
    if (recent.length === 0) {
      this.timestamps.delete(key);  // Remove idle users from memory
    } else {
      this.timestamps.set(key, recent);
    }
  }
}
```

This means if a user makes requests then leaves, their entry is cleaned up within 2 window durations. Never more than ~120 seconds of stale data.

### The `destroy()` Method

```typescript
destroy() {
  if (this.cleanupInterval) {
    clearInterval(this.cleanupInterval);
    this.cleanupInterval = null;
  }
  this.timestamps.clear();
}
```

Useful for testing — you can create and destroy rate limiters without leaking memory.

---

## Why In-Memory Instead of Redis?

### The Problem with Redis

**Upstash Redis** is the standard choice for rate limiting in serverless environments. But it has a problem:

```
Request comes in
  → Call Upstash Redis (network call to us-east-1)
  → ~30-50ms latency
  → Even worse: ~5s cold start if Redis was asleep
  → Response sent
```

For a **college project with modest traffic**, that network call takes longer than the actual request processing. It's over-engineering.

### The Tradeoff We Made

| Factor | Redis | Our In-Memory Solution |
|---|---|---|
| **Latency** | ~30-50ms per check (network call) | **<1ms** (just a Map lookup) |
| **Cold start** | ~5s if Upstash scales to zero | **Zero** — starts instantly |
| **Shared state** | ✅ Across all server instances | ❌ Per server instance only |
| **Persistence** | ✅ Survives server restarts | ❌ Resets on restart |
| **External dependency** | ✅ Requires Upstash account + env vars | ❌ Nothing needed — works out of the box |
| **Cost** | $0 (free tier) but still needs setup | **$0 and zero setup** |

### Why This Tradeoff Is Okay for Our Use Case

1. **Vercel's single-instance behavior** — For most traffic levels, Vercel doesn't spin up multiple instances. The in-memory state is effectively shared.

2. **Rate limiting doesn't need to be perfect** — The goal is to stop obvious abuse (rapid-fire requests from one user), not to enforce exact quotas across a distributed system. Even if someone hits a different instance and slips through, they're limited on the next request.

3. **No external dependency** — New developers can clone the repo and the rate limiter just works. No need to sign up for Upstash, configure env vars, or handle connection failures.

### The "Grow Into" Strategy

> **"We designed the rate limiter so it can be swapped out later. The `limit()` method returns `{ success: boolean }` — the exact same interface as Upstash's Ratelimit. If we ever need cross-instance rate limiting, we swap one import and nothing else changes."**

```typescript
// Current: one-line change to switch to Redis
import { InMemoryRatelimit } from "./rateLimiterMemory";
// → import { Ratelimit } from "@upstash/ratelimit";

export const apiRateLimit = new InMemoryRatelimit(60, "60 s");
// → export const apiRateLimit = new Ratelimit({ ... });
```

### What We'd Lose by Switching to Redis

If we switched to Redis, we'd gain cross-instance sharing but lose:

- **Simplicity** — No account setup, no API keys, no env vars
- **Speed** — Sub-millisecond checks instead of 30-50ms network calls
- **Reliability** — No network errors, no timeouts, no rate limit on the rate limiter
- **Offline capability** — Rate limiting works even when external services are down

---

## Bonus: The `parseWindow` Helper

```typescript
function parseWindow(window: string): number {
  const match = window.trim().match(/^(\\d+)\\s*(s|m|h)$/);
  if (!match) {
    throw new Error(`Invalid window format: "${window}". Use e.g. "10 s", "60 s", "10 m"`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "s": return value * 1000;
    case "m": return value * 60_000;
    case "h": return value * 3_600_000;
    default: return value * 1000;
  }
}
```

This parses human-readable strings like `"10 s"`, `"60 s"`, `"5 m"` into milliseconds. It has error handling built in — if someone passes `"banana"`, it throws a clear error instead of silently returning `NaN`.

---

## Summary: The Complete Flow

```
Request arrives at API route
        │
        ▼
┌───────────────────────────────┐
│ checkRateLimit(limiter, req)  │
│                               │
│ 1. Extract IP from headers:   │
│    x-forwarded-for → x-real-ip│
│    → "anonymous"              │
│                               │
│ 2. Call limiter.limit(IP)     │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ InMemoryRatelimit.limit(id)   │
│                               │
│ 1. Get existing timestamps    │
│    for this user from the Map │
│                               │
│ 2. Filter out timestamps      │
│    older than the window      │
│    (the "sliding" part)       │
│                               │
│ 3. Count remaining:           │
│    ┌─ < max? → Add timestamp │
│    │          Return ✅       │
│    │                          │
│    └─ ≥ max? → Return ❌      │
└───────────────┬───────────────┘
                │
       ┌────────┴────────┐
       ▼                  ▼
    ✅ ALLOWED         ❌ BLOCKED
       │                  │
       ▼                  ▼
  Process request     Return 429
  normally            "Too many
                      requests"
```

---

## The Interview-Ready Answer

If an interviewer asks **"Why did you build your own rate limiter instead of using Redis?"**, here's your answer:

> **"We built an in-memory sliding window rate limiter because Redis was overkill for our use case. The sliding window algorithm stores a Map of user IDs to timestamp arrays. When a request comes in, we filter out timestamps older than the window, check if the count exceeds the limit, and either allow or block the request.**
>
> **We chose this over Redis for three reasons:**
>
> **First, latency.** A Redis call adds 30-50ms of network latency per request — on a college project, that's more than the actual request processing time. Our in-memory solution is sub-millisecond.
>
> **Second, zero external dependencies.** Anyone cloning the repo gets rate limiting for free — no Upstash accounts, no environment variables, no connection error handling. It just works.
>
> **Third, abstraction.** Our `InMemoryRatelimit` class has the exact same `limit() → { success }` interface as Upstash's Ratelimit. If we ever need cross-instance rate limiting when scaling up, it's a one-line change to swap the import.
>
> **The tradeoff is that in-memory state doesn't persist across server restarts and isn't shared between Vercel instances.** But for protecting against brute-force attacks, accidental request loops, and obvious spam from a single user, it's more than adequate. It's a pragmatic choice for the project's scale."

---

*MessLess · Made by Thapar, for Thapar*
*GitHub: github.com/sohamsachdeva/messless*
