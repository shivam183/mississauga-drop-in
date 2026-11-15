/**
 * GET /api/availability?ids=166860,164542[&fresh=1]
 *
 * Spots left and enroll status for up to 20 upcoming "enroll online" sessions
 * (ids are ActiveNet activity ids, which are per session for these).
 * `fresh=1` skips the 60-second cache and is rate-limited per IP.
 * See docs/api.md.
 */
import type { NextRequest } from "next/server";
import { apiError, CORS_HEADERS, torontoIso } from "@/lib/api";
import { getAvailability, MAX_AVAILABILITY_IDS } from "@/lib/availability";
import { toTorontoLocal } from "@/lib/dates";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";
import { toEnrollState, type EnrollState } from "@/models/availability";

/** Refreshes per IP per minute that bypass the cache. */
const FRESH_PER_MINUTE = 10;
const freshLimiter = createRateLimiter({ limit: FRESH_PER_MINUTE, windowMs: 60_000 });

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const raw = (params.get("ids") ?? "").split(",").filter(Boolean);
  if (raw.length === 0) return apiError(400, "Pass ids, e.g. ?ids=166860,164542");
  if (raw.length > MAX_AVAILABILITY_IDS) {
    return apiError(400, `At most ${MAX_AVAILABILITY_IDS} ids per request`);
  }
  const ids = raw.map(Number);
  if (!ids.every((id) => Number.isInteger(id) && id > 0)) {
    return apiError(400, "ids must be positive integers");
  }

  const fresh = params.get("fresh") === "1";
  if (fresh && !freshLimiter.allow(clientIp(request.headers))) {
    return apiError(429, "Too many refreshes. Try again in a minute.", { "Retry-After": "60" });
  }

  try {
    const result = await getAvailability(ids, { fresh });
    const now = toTorontoLocal(new Date());
    // The Enroll button state per session, worked out now (opensAt as ISO 8601).
    const enroll: Record<number, EnrollState> = {};
    for (const [id, status] of Object.entries(result.statuses)) {
      const state = toEnrollState(status, now);
      enroll[Number(id)] =
        state.state === "opens" ? { ...state, opensAt: torontoIso(state.opensAt) } : state;
    }
    return Response.json(
      { now, ...result, enroll },
      { headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    if (cause instanceof RangeError) return apiError(400, cause.message);
    console.error("[api/availability]", cause);
    return apiError(502, "Couldn't reach ActiveMississauga. Try again shortly.");
  }
}
