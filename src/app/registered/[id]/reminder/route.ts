/**
 * GET /registered/{id}/reminder
 *
 * "Remind me": an .ics event when the program's online registration opens,
 * with the enroll link. Not found unless registration is still to open.
 */
import { calendarResponse } from "@/lib/calendar";
import { getProgram } from "@/lib/registered";
import { reminderEvent } from "@/models/calendar";

export async function GET(_request: Request, ctx: RouteContext<"/registered/[id]/reminder">) {
  const { id } = await ctx.params;
  const program = await getProgram(/^\d{1,12}$/.test(id) ? Number(id) : NaN);
  if (!program || program.enroll.state !== "opens") {
    return new Response("Not found", { status: 404 });
  }
  const { info, enroll } = program;
  const event = reminderEvent(
    {
      name: info.name,
      location: [info.centre?.name, info.centre?.address].filter(Boolean).join(", "),
      page: `/registered/${program.id}`,
    },
    enroll.opensAt,
    enroll.url,
    `reminder-program-${program.id}@mississaugadropin.com`,
  );
  return calendarResponse(`registration-${info.name}`, [event]);
}
