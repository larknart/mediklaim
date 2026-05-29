interface Bucket {
  count: number;
  windowStart: number;
}

const store = new Map<string, Bucket>();

// Prune entries older than 2 windows to prevent unbounded growth
function prune(windowMs: number) {
  const cutoff = Date.now() - windowMs * 2;
  for (const [key, bucket] of store) {
    if (bucket.windowStart < cutoff) store.delete(key);
  }
}

/**
 * Sliding window rate limiter keyed by arbitrary string (e.g. "ip:route").
 * Returns true when the request should be allowed, false when rate-limited.
 */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    if (store.size % 500 === 0) prune(windowMs);
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count++;
  return true;
}
