import type { NextConfig } from "next";

/**
 * Content Security Policy. Everything the app loads comes from its own
 * origin; the City's site is only ever linked to. Inline scripts stay
 * allowed because Next.js bootstraps with them (nonces would force every
 * page to render per request). Production only: `next dev` needs eval.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://va.vercel-scripts.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy", value: CSP }]
    : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Cache lifetimes (seconds) used with "use cache" in src/lib/. See docs/architecture.md.
  cacheLife: {
    // Session schedules and enroll links/opening times: refreshed every 10 minutes.
    schedule: { stale: 300, revalidate: 600, expire: 3600 },
    // Spots left: refreshed every 60 seconds; each count shows when it was checked.
    spots: { stale: 30, revalidate: 60, expire: 600 },
    // Activity descriptions, ages and centres (details popup): they change at most each season.
    info: { stale: 3600, revalidate: 86400, expire: 604800 },
  },
  headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
