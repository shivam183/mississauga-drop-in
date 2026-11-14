/**
 * A small fixed-window rate limiter kept in memory. It is per server
 * instance, which is enough to stop one visitor hammering the refresh button
 * and, through it, the City's servers.
 */
export interface RateLimiter {
  /** Records a hit for `key` and returns whether it is within the limit. */
  allow(key: string): boolean;
}

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 10_000,
}: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();

  return {
    allow(key) {
      const now = Date.now();
      const window = windows.get(key);
      if (!window || now - window.start >= windowMs) {
        if (windows.size >= maxKeys) {
          for (const [k, w] of windows) if (now - w.start >= windowMs) windows.delete(k);
          if (windows.size >= maxKeys) windows.delete(windows.keys().next().value!);
        }
        windows.set(key, { start: now, count: 1 });
        return true;
      }
      window.count++;
      return window.count <= limit;
    },
  };
}

/** The client's IP as reported by the hosting proxy, or "unknown". */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
