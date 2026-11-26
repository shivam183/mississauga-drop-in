/**
 * GET /registered/{id}/calendar
 *
 * A registered program's classes as an .ics file: each meeting pattern as a
 * weekly event (holidays skipped), and any one-off extra dates.
 */
import { calendarResponse } from "@/lib/calendar";
import { getProgram } from "@/lib/registered";
import { patternEvent } from "@/models/calendar";

export async function GET(_request: Request, ctx: RouteContext<"/registered/[id]/calendar">) {
  const { id } = await ctx.params;
  const program = await getProgram(/^\d{1,12}$/.test(id) ? Number(id) : NaN);
  if (!program) return new Response("Not found", { status: 404 });
  const { info } = program;
  const centre = info.centre;
  const base = {
    title: info.name,
    location: [centre?.name, centre?.address].filter(Boolean).join(", "),
    url: program.cityUrl,
    page: `/registered/${program.id}`,
  };
  const events = program.calendar.flatMap((pattern, i) => {
    const event = patternEvent(pattern, base, `program-${program.id}-${i}@mississaugadropin.com`);
    return event ? [event] : [];
  });
  if (events.length === 0) return new Response("Not found", { status: 404 });
  return calendarResponse(info.name, events);
}
