// ============================================================
// lib/rateLimiter.ts
// Rate limiters for different API route categories.
// Uses in-memory sliding window (no Redis, no network calls).
// ============================================================

import { InMemoryRatelimit } from "./rateLimiterMemory";

/**
 * Auth routes (login, register, forgot/reset password, OTP, etc.)
 * Strict limits to prevent brute-force attacks.
 * 10 requests per 10 seconds per identifier.
 */
export const authRateLimit = new InMemoryRatelimit(10, "10 s");

/**
 * General API routes (browse, search, hubs, vendors, menu, etc.)
 * Moderate limits for typical browsing traffic.
 * 60 requests per 60 seconds per identifier.
 */
export const apiRateLimit = new InMemoryRatelimit(60, "60 s");

/**
 * Admin API routes (dashboard, analytics, manage vendors/menu/stats)
 * Lower limit to prevent abuse of sensitive endpoints.
 * 30 requests per 60 seconds per identifier.
 */
export const adminRateLimit = new InMemoryRatelimit(30, "60 s");

/**
 * Cart & Order routes (add/remove from cart, checkout, orders)
 * Moderate limits — these are write-heavy endpoints.
 * 30 requests per 60 seconds per identifier.
 */
export const orderRateLimit = new InMemoryRatelimit(30, "60 s");

/**
 * Payment (Razorpay) routes — webhooks need room for retries.
 * 100 requests per 60 seconds.
 */
export const paymentRateLimit = new InMemoryRatelimit(100, "60 s");

/**
 * Standard rate limit response for 429 status.
 */
export function rateLimitResponse(): Response {
  return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": "10" },
  });
}

/**
 * Check rate limit for a request and return a 429 response if exceeded.
 * Call this at the top of any API route handler.
 *
 * @param limiter - The rate limiter instance to use (e.g. apiRateLimit, authRateLimit)
 * @param req - Optional Request object to extract IP/user identifier from
 * @returns A 429 Response if rate limited, or null if allowed to proceed
 *
 * @example
 * ```ts
 * const rl = await checkRateLimit(apiRateLimit, req);
 * if (rl) return rl;
 * ```
 */
export async function checkRateLimit(
  limiter: InMemoryRatelimit,
  req?: Request,
): Promise<Response | null> {
  const identifier = req
    ? (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
       req.headers.get("x-real-ip") ??
       "anonymous")
    : "anonymous";

  const { success } = await limiter.limit(identifier);
  if (!success) return rateLimitResponse();
  return null;
}
