/**
 * GET /api/sessions?q=&type=&centre=&day=&from=&to=&time=&limit=&offset=
 *
 * Upcoming sessions (not yet ended), soonest first, with the same filters as
 * the site. Paginated: at most 200 per request. See docs/api.md.
 */
import type { NextRequest } from "next/server";
import { apiError, CORS_HEADERS, parsePage, toApiSession, toRawSearchParams } from "@/lib/api";
import { toTorontoLocal } from "@/lib/dates";
import { parseSearchParams, toFilters } from "@/lib/params";
import { getSchedule } from "@/lib/schedule";
import { filterSessions } from "@/models/filters";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = parsePage(params);
  if ("error" in page) return apiError(400, page.error);

  let schedule;
  try {
    schedule = await getSchedule();
  } catch (cause) {
    console.error("[api/sessions]", cause);
    return apiError(502, "Couldn't reach ActiveMississauga. Try again shortly.");
  }

  const now = new Date();
  const filters = toFilters(parseSearchParams(toRawSearchParams(params)));
  const matches = filterSessions(schedule.sessions, filters, toTorontoLocal(now));
  const slice = matches.slice(page.offset, page.offset + page.limit);

  let next: string | null = null;
  if (page.offset + page.limit < matches.length) {
    const url = new URL(request.nextUrl);
    url.searchParams.set("offset", String(page.offset + page.limit));
    url.searchParams.set("limit", String(page.limit));
    next = `${url.pathname}${url.search}`;
  }

  return Response.json(
    {
      generatedAt: now.toISOString(),
      total: matches.length,
      offset: page.offset,
      limit: page.limit,
      next,
      sessions: slice.map(toApiSession),
      // Centres whose schedule couldn't be loaded just now; results may miss them.
      failedCentres: schedule.failedCentres.map(({ id, name }) => ({ id, name })),
    },
    {
      headers: {
        ...CORS_HEADERS,
        // Shared caches may reuse a response for a minute (sessions end, so not longer).
        "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
