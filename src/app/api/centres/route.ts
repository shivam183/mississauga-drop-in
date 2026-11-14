/**
 * GET /api/centres
 *
 * Every community centre, with the kinds of sessions it lists. Built from
 * data/ at build time, so it's static. See docs/api.md.
 */
import { CORS_HEADERS } from "@/lib/api";
import { ALL_CENTRES, CENTRES_BY_TYPE } from "@/lib/centres";
import type { SessionType } from "@/models/session";

export function GET() {
  const types = (id: number): SessionType[] =>
    (["dropin", "enrol"] as const).filter((type) => CENTRES_BY_TYPE[type].some((c) => c.id === id));

  return Response.json(
    { centres: ALL_CENTRES.map(({ id, name }) => ({ id, name, types: types(id) })) },
    {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    },
  );
}
