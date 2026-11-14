/**
 * GET /api/availability?ids=166860,164542[&fresh=1]
 *
 * Spots left and enrol status for up to 20 upcoming "enrol online" sessions
 * (ids are ActiveNet activity ids, which are per session for these).
 * `fresh=1` skips the 60-second cache and is rate-limited per IP.
 */
import type { NextRequest } from "next/server";
import { getAvailability, MAX_AVAILABILITY_IDS } from "@/lib/availability";
import { toTorontoLocal } from "@/lib/dates";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

/** Refreshes per IP per minute that bypass the cache. */
const FRESH_PER_MINUTE = 10;
const freshLimiter = createRateLimiter({ limit: FRESH_PER_MINUTE, windowMs: 60_000 });

const NO_STORE = { "Cache-Control": "no-store" };

function error(status: number, message: string, headers: Record<string, string> = {}) {
  return Response.json({ error: message }, { status, headers: { ...NO_STORE, ...headers } });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const raw = (params.get("ids") ?? "").split(",").filter(Boolean);
  if (raw.length === 0) return error(400, "Pass ids, e.g. ?ids=166860,164542");
  if (raw.length > MAX_AVAILABILITY_IDS) {
    return error(400, `At most ${MAX_AVAILABILITY_IDS} ids per request`);
  }
  const ids = raw.map(Number);
  if (!ids.every((id) => Number.isInteger(id) && id > 0)) {
    return error(400, "ids must be positive integers");
  }

  const fresh = params.get("fresh") === "1";
  if (fresh && !freshLimiter.allow(clientIp(request.headers))) {
    return error(429, "Too many refreshes. Try again in a minute.", { "Retry-After": "60" });
  }

  try {
    const result = await getAvailability(ids, { fresh });
    return Response.json({ now: toTorontoLocal(new Date()), ...result }, { headers: NO_STORE });
  } catch (cause) {
    if (cause instanceof RangeError) return error(400, cause.message);
    console.error("[api/availability]", cause);
    return error(502, "Couldn't reach ActiveMississauga. Try again shortly.");
  }
}
