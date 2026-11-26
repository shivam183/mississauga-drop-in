/**
 * Calendar files (.ics, RFC 5545) for "Add to calendar": one session, or a
 * registered program's weekly classes. Times are Toronto local time, with a
 * Toronto VTIMEZONE so weekly events keep their clock time across DST.
 */
import type { LocalDateTime } from "@/lib/activenet/types";
import { COFFEE_URL, SITE_URL } from "@/lib/site";

/** A weekly meeting pattern: these weekdays, from..until, at start..end. One-off dates use from = until. */
export interface CalendarPattern {
  /** ICS weekday codes: "MO", "SA". */
  days: string[];
  /** "YYYY-MM-DD", the first and last dates it can meet. */
  from: string;
  until: string;
  /** "HH:MM:SS" */
  start: string;
  end: string;
  /** "YYYY-MM-DD" dates it doesn't meet (holidays). */
  except: string[];
}

export interface CalendarEvent {
  /** Unique and stable, so re-adding updates rather than duplicates. */
  uid: string;
  title: string;
  location: string;
  /** Where to find out more: the City's page. */
  url: string | null;
  /** Its page on this site: "/registered/158821". */
  page: string;
  start: LocalDateTime;
  end: LocalDateTime;
  /** Repeats weekly on these days until this date ("YYYY-MM-DD"), skipping `except`. */
  weekly?: { days: string[]; until: string; except: string[] };
  /** An alert this many minutes before it starts. */
  alertMinutes?: number;
}

const ICS_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const CITY_DAYS: Record<string, string[]> = {
  sun: ["SU"],
  mon: ["MO"],
  tue: ["TU"],
  wed: ["WE"],
  thu: ["TH"],
  fri: ["FR"],
  sat: ["SA"],
  weekdays: ["MO", "TU", "WE", "TH", "FR"],
  weekends: ["SA", "SU"],
  daily: ICS_DAYS,
};

/** The City's "Mon, Tue, Wed" / "Sat" / "Weekdays" as ICS codes; null if any part is unknown. */
export function cityWeekdays(raw: string): string[] | null {
  const parts = raw
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const days = parts.map((p) => CITY_DAYS[p]);
  if (days.length === 0 || days.some((d) => !d)) return null;
  return [...new Set(days.flat())];
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** The City's exception dates: "25 Dec 2026" or "24,30,31 Dec 2026" -> ["2026-12-24", …]; unknown text is skipped. */
export function cityDates(raw: string): string[] {
  const m = /^\s*([\d,\s]+)\s+([a-z]{3})[a-z]*\s+(\d{4})\s*$/i.exec(raw);
  const month = m ? MONTHS.indexOf(m[2].toLowerCase()) + 1 : 0;
  if (!m || month === 0) return [];
  return m[1]
    .split(",")
    .map((d) => d.trim())
    .filter((d) => /^\d{1,2}$/.test(d))
    .map((d) => `${m[3]}-${String(month).padStart(2, "0")}-${d.padStart(2, "0")}`);
}

const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** "2026-11-24 07:00:00" plus 15 minutes, as Toronto wall-clock time (no zone maths needed for minutes). */
const addMinutes = (t: LocalDateTime, n: number): LocalDateTime =>
  new Date(Date.parse(`${t.replace(" ", "T")}Z`) + n * 60_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

/**
 * "Remind me": a 15-minute event when registration opens, with an alert 10
 * minutes before, so you're ready to enroll the moment it opens.
 */
export function reminderEvent(
  what: { name: string; location: string; page: string },
  opensAt: LocalDateTime,
  enrollUrl: string,
  uid: string,
): CalendarEvent {
  return {
    uid,
    title: `Registration opens: ${what.name}`,
    location: what.location,
    url: enrollUrl,
    page: what.page,
    start: opensAt,
    end: addMinutes(opensAt, 15),
    alertMinutes: 10,
  };
}

/** A pattern as one event: its first meeting, repeating weekly when it spans more than a day. Null if it never meets. */
export function patternEvent(
  pattern: CalendarPattern,
  base: Omit<CalendarEvent, "uid" | "start" | "end" | "weekly">,
  uid: string,
): CalendarEvent | null {
  const wanted = new Set(pattern.days.map((d) => ICS_DAYS.indexOf(d)));
  let first = pattern.from;
  while (
    first <= pattern.until &&
    (!wanted.has(weekdayOf(first)) || pattern.except.includes(first))
  ) {
    first = addDays(first, 1);
  }
  if (first > pattern.until) return null;
  const event: CalendarEvent = {
    ...base,
    uid,
    start: `${first} ${pattern.start}`,
    end: `${first} ${pattern.end}`,
  };
  if (pattern.until > first) {
    event.weekly = { days: pattern.days, until: pattern.until, except: pattern.except };
  }
  return event;
}

// Writing the file -----------------------------------------------------------

/** Text values escape backslash, semicolon, comma and newlines. */
const escape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines are folded at 75 bytes (UTF-8), continuing with a space. */
function fold(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = new TextEncoder().encode(ch).length;
    if (bytes + size > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

/** "2026-12-24 08:30:00" -> "20261224T083000" */
const local = (t: string) => t.replace(/[-:]/g, "").replace(" ", "T");

// Toronto's rules since 2007: EDT from the 2nd Sunday of March, EST from the 1st Sunday of November.
const TORONTO = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Toronto",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:20070311T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:20071104T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** A whole .ics file for these events. `now` stamps them (DTSTAMP). */
export function toIcs(events: CalendarEvent[], now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mississauga Drop-In//mississaugadropin.com//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...TORONTO,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=America/Toronto:${local(e.start)}`,
      `DTEND;TZID=America/Toronto:${local(e.end)}`,
      `SUMMARY:${escape(e.title)}`,
      `LOCATION:${escape(e.location)}`,
    );
    if (e.url) lines.push(`URL:${e.url}`);
    // The City's link, then a blank line, then ours.
    const ours = [
      `Found on mississaugadropin.com: ${SITE_URL}${e.page}`,
      `Saved you a trip? Buy me a coffee: ${COFFEE_URL}`,
    ].join("\n");
    const notes = e.url ? `Details and registration: ${e.url}\n\n${ours}` : ours;
    lines.push(`DESCRIPTION:${escape(notes)}`);
    if (e.weekly) {
      // UNTIL is UTC when DTSTART has a zone: 05:00Z the next day is after midnight in Toronto, EST or EDT.
      const until = `${addDays(e.weekly.until, 1).replace(/-/g, "")}T050000Z`;
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${e.weekly.days.join(",")};UNTIL=${until}`);
      const time = e.start.slice(11);
      for (const date of e.weekly.except) {
        lines.push(`EXDATE;TZID=America/Toronto:${local(`${date} ${time}`)}`);
      }
    }
    if (e.alertMinutes !== undefined) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escape(e.title)}`,
        `TRIGGER:-PT${e.alertMinutes}M`,
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** A safe file name: "Lane & Leisure Swim" -> "lane-leisure-swim.ics". */
export const icsFileName = (title: string) =>
  `${
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "event"
  }.ics`;
