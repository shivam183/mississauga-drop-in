/**
 * GET /activity/{id}/reminder
 *
 * "Remind me" for an enroll-online session (its id is the session's): an .ics
 * event when online enrollment opens, with the enroll link. Not found unless
 * enrollment is still to open.
 */
import { getActivity } from "@/lib/activity";
import { getAvailability } from "@/lib/availability";
import { calendarResponse } from "@/lib/calendar";
import { toTorontoLocal } from "@/lib/dates";
import { displayTitle } from "@/lib/format";
import { toEnrollState } from "@/models/availability";
import { reminderEvent } from "@/models/calendar";

export async function GET(_request: Request, ctx: RouteContext<"/activity/[id]/reminder">) {
  const { id } = await ctx.params;
  const activityId = /^\d{1,12}$/.test(id) ? Number(id) : NaN;
  const activity = await getActivity(activityId);
  const session = activity?.sessions.find((s) => s.type === "enroll");
  if (!activity || !session) return new Response("Not found", { status: 404 });
  const { statuses } = await getAvailability([activityId]);
  const status = statuses[activityId];
  const state = status && toEnrollState(status, toTorontoLocal(new Date()));
  if (!state || state.state !== "opens") return new Response("Not found", { status: 404 });
  const centre = activity.info?.centre;
  const room = session.facility ? ` · ${session.facility}` : "";
  const name = activity.info?.name || displayTitle(session.title);
  const event = reminderEvent(
    {
      name,
      location: [`${session.centreName}${room}`, centre?.address].filter(Boolean).join(", "),
      page: `/activity/${activityId}?session=${session.id}`,
    },
    state.opensAt,
    state.url,
    `reminder-${session.id}@mississaugadropin.com`,
  );
  return calendarResponse(`registration-${name}`, [event]);
}
