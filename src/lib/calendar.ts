import { icsFileName, toIcs, type CalendarEvent } from "@/models/calendar";

/** An .ics download. Phones offer to add it to the calendar; computers save the file. */
export function calendarResponse(title: string, events: CalendarEvent[]): Response {
  return new Response(toIcs(events, new Date()), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFileName(title)}"`,
      // Times and spots can change; a calendar file is cheap to remake.
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
