/**
 * GET /api/programs?q=&cat=&season=&age=&day=&centre=&open=&page=
 *
 * Registered programs, with the same filters as /registered, searched live on
 * the City's site: 20 per page, at most 10 pages, like the site. See docs/api.md.
 */
import type { NextRequest } from "next/server";
import { PROGRAMS_PER_PAGE } from "@/lib/activenet/client";
import { apiError, CORS_HEADERS, toApiProgram } from "@/lib/api";
import { toRawSearchParams } from "@/lib/params";
import { searchPrograms } from "@/lib/registered";
import { MAX_PAGES, parseProgramParams } from "@/models/registered";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawPage = params.get("page");
  const page = rawPage === null ? 1 : Number(rawPage);
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGES) {
    return apiError(400, `page must be a whole number from 1 to ${MAX_PAGES}`);
  }
  const search = { ...parseProgramParams(toRawSearchParams(params)), pages: page };

  let results;
  try {
    results = await searchPrograms(search, page);
  } catch (cause) {
    console.error("[api/programs]", cause);
    return apiError(502, "Couldn't reach ActiveMississauga. Try again shortly.");
  }

  let next: string | null = null;
  if (page < MAX_PAGES && results.total > page * PROGRAMS_PER_PAGE) {
    const url = new URL(request.nextUrl);
    url.searchParams.set("page", String(page + 1));
    next = `${url.pathname}${url.search}`;
  }

  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      total: results.total,
      page,
      perPage: PROGRAMS_PER_PAGE,
      next,
      programs: results.programs.map(toApiProgram),
    },
    {
      headers: {
        ...CORS_HEADERS,
        // Spots change; shared caches may reuse a response for a minute.
        "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
