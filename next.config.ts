import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Cache lifetimes (seconds) used with "use cache" in src/lib/. See docs/architecture.md.
  cacheLife: {
    // Session schedules and enrol links/opening times: refreshed every 10 minutes.
    schedule: { stale: 300, revalidate: 600, expire: 3600 },
    // Spots left: refreshed every 60 seconds; each count shows when it was checked.
    spots: { stale: 30, revalidate: 60, expire: 600 },
  },
};

export default nextConfig;
