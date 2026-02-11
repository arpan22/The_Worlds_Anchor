/**
 * Simple sliding-window rate limiter (in-memory).
 *
 * Tracks requests per IP within a configurable time window.
 * Returns 429 when the limit is exceeded.
 */

const buckets = new Map(); // ip -> { count, resetAt }

export function rateLimiter({ windowMs = 60_000, maxRequests = 30 } = {}) {
  // Cleanup stale buckets every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(ip);
    }
  }, 5 * 60_000);

  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();

    let bucket = buckets.get(ip);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
    }

    bucket.count += 1;

    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - bucket.count)));
    res.set('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfterMs: bucket.resetAt - now,
      });
    }

    next();
  };
}
