/**
 * GET /api/programs/filters
 *
 * The ids /api/programs filters by: locations, categories and seasons, from
 * the City's activity search. See docs/api.md.
 */
import { apiError, CORS_HEADERS } from "@/lib/api";
import { getProgramOptions } from "@/lib/registered";

export async function GET() {
  let options;
  try {
    options = await getProgramOptions();
  } catch (cause) {
    console.error("[api/programs/filters]", cause);
    return apiError(502, "Couldn't reach ActiveMississauga. Try again shortly.");
  }
  const { centres, categories, seasons } = options;
  return Response.json(
    { locations: centres, categories, seasons },
    { headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
