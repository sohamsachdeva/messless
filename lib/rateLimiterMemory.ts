// ============================================================
// lib/rateLimiterMemory.ts
// In-memory sliding window rate limiter.
// Replaces Upstash Redis-based rate limiting to eliminate
// ~5s network delays while keeping the same security logic.
//
// IMPORTANT: In serverless environments (Vercel), each function
// invocation is isolated, so state isn't shared between instances.
// This still provides effective protection against:
//   - Rapid-fire spam from a single user within one session
//   - Accidental request loops (e.g. infinite useEffect)
//   - Obvious abuse patterns
//
// For long-running servers, this works identically to Redis.
// ============================================================

/**
 * Sliding window rate limiter stored entirely in memory.
 * No network calls, no dependencies — instant checks.
 */
export class InMemoryRatelimit {
  private timestamps: Map<string, number[]>;
  private maxRequests: number;
  private windowMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * @param maxRequests - Max number of requests allowed within the window
   * @param window      - Duration of the sliding window (e.g. "10 s", "60 s", "10 m")
   */
  constructor(maxRequests: number, window: string) {
    this.timestamps = new Map();
    this.maxRequests = maxRequests;
    this.windowMs = parseWindow(window);

    // Clean up stale entries every 60 seconds to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);

    // Allow the cleanup interval to not block process exit
    if (this.cleanupInterval && typeof this.cleanupInterval === "object") {
      this.cleanupInterval.unref?.();
    }
  }

  /**
   * Check if a request should be rate limited.
   * Matches the Upstash Ratelimit interface: `limit(id) → { success }`
   * @returns `{ success: true }` if allowed, `{ success: false }` if blocked
   */
  async limit(identifier: string): Promise<{ success: boolean }> {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let timestamps = this.timestamps.get(identifier) ?? [];

    // Remove timestamps outside the current window
    timestamps = timestamps.filter((t) => t > cutoff);

    if (timestamps.length >= this.maxRequests) {
      // Store the filtered list (still rate limited)
      this.timestamps.set(identifier, timestamps);
      return { success: false };
    }

    // Add the current request timestamp
    timestamps.push(now);
    this.timestamps.set(identifier, timestamps);
    return { success: true };
  }

  /**
   * Remove entries that haven't been accessed in over 2x the window,
   * preventing unbounded memory growth.
   */
  private cleanup() {
    const cutoff = Date.now() - this.windowMs * 2;
    for (const [key, timestamps] of this.timestamps.entries()) {
      const recent = timestamps.filter((t) => t > cutoff);
      if (recent.length === 0) {
        this.timestamps.delete(key);
      } else {
        this.timestamps.set(key, recent);
      }
    }
  }

  /**
   * Free resources. Call this if you're done with the rate limiter.
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.timestamps.clear();
  }
}

/**
 * Parse a human-readable window string into milliseconds.
 * Examples: "10 s" → 10000, "60 s" → 60000, "10 m" → 600000
 */
function parseWindow(window: string): number {
  const match = window.trim().match(/^(\d+)\s*(s|m|h)$/);
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
