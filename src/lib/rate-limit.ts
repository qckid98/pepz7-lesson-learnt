import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiter (no Redis needed)
// For production with multiple instances, use Redis-based limiter

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  message?: string; // Error message
}

/**
 * Rate limit middleware for API routes
 * Returns null if request is allowed, or NextResponse with 429 if rate limited
 */
export function rateLimit(
  request: NextRequest,
  options: RateLimitOptions
): NextResponse | null {
  // Get client IP (check forwarded headers first)
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const key = `${ip}:${request.nextUrl.pathname}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // First request or window expired
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + options.windowMs,
    });
    return null;
  }

  entry.count++;

  if (entry.count > options.max) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return NextResponse.json(
      {
        error: options.message || "Too many requests",
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Limit": options.max.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": entry.resetTime.toString(),
        },
      }
    );
  }

  return null;
}

// Pre-configured rate limits for common use cases
export const RATE_LIMITS = {
  // General API: 100 requests per minute
  api: { windowMs: 60 * 1000, max: 100, message: "Too many API requests" },

  // Login: 5 attempts per 5 minutes
  login: {
    windowMs: 5 * 60 * 1000,
    max: 5,
    message: "Too many login attempts. Try again in 5 minutes.",
  },

  // Upload: disabled (admin-only endpoint, folder uploads need high limits)
  upload: {
    windowMs: 60 * 1000,
    max: 999,
    message: "Too many uploads. Please wait.",
  },

  // Download: 100 downloads per minute (viewers browsing files)
  download: {
    windowMs: 60 * 1000,
    max: 100,
    message: "Too many downloads. Please wait.",
  },

  // Search: 30 searches per minute
  search: {
    windowMs: 60 * 1000,
    max: 30,
    message: "Too many search requests.",
  },

  // Folder creation: 20 per minute
  create: {
    windowMs: 60 * 1000,
    max: 20,
    message: "Too many create operations.",
  },
} as const;
