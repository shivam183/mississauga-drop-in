/**
 * GET /activity/{id}/calendar?session={sessionId}
 *
 * One drop-in or enroll-online session as an .ics file, for "Add to calendar"
 * in the details popup. Not found if the session isn't upcoming.
 */
import type { NextRequest } from "next/server";
import { getActivity } from "@/lib/activity";
import { calendarResponse } from "@/lib/calendar";
import { displayTitle } from "@/lib/format";

export async function GET(request: NextRequest, ctx: RouteContext<"/activity/[id]/calendar">) {
  const { id } = await ctx.params;
  const sessionId = request.nextUrl.searchParams.get("session");
  const activity = await getActivity(/^\d{1,12}$/.test(id) ? Number(id) : NaN);
  const session = activity?.sessions.find((s) => s.id === sessionId);
  if (!activity || !session) return new Response("Not found", { status: 404 });
  const centre = activity.info?.centre;
  const room = session.facility ? ` · ${session.facility}` : "";
  return calendarResponse(displayTitle(session.title), [
    {
      uid: `${session.id}@mississaugadropin.com`,
      title: activity.info?.name || displayTitle(session.title),
      location: [`${session.centreName}${room}`, centre?.address].filter(Boolean).join(", "),
      url: session.url,
      page: `/activity/${session.activityId}?session=${session.id}`,
      start: session.start,
      end: session.end,
    },
  ]);
}
