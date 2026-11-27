/**
 * Display formatting. Session times are already Toronto wall-clock strings
 * ("YYYY-MM-DD HH:mm:ss"), so they're formatted from their parts, never via
 * Date, which would shift them into the viewer's time zone.
 */
import type { LocalDateTime } from "@/lib/activenet/types";
import { TORONTO_TIME_ZONE } from "@/lib/dates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function clock(time: LocalDateTime): { h: number; m: string; pm: boolean } {
  const h24 = Number(time.slice(11, 13));
  return { h: h24 % 12 || 12, m: time.slice(14, 16), pm: h24 >= 12 };
}

/** "7" on the hour, else "7:30": shorter, so a time that crosses noon fits beside the card's badge. */
const hourMinute = ({ h, m }: { h: number; m: string }) => (m === "00" ? `${h}` : `${h}:${m}`);

/** "7 PM", "7:30 PM" */
export function formatTime(time: LocalDateTime): string {
  const c = clock(time);
  return `${hourMinute(c)} ${c.pm ? "PM" : "AM"}`;
}

/** "7 – 9 PM", "7:30 – 9 PM", or "10 AM – 12:30 PM" when it crosses noon. */
export function formatTimeRange(start: LocalDateTime, end: LocalDateTime): string {
  const a = clock(start);
  const b = clock(end);
  const startText = a.pm === b.pm ? hourMinute(a) : formatTime(start);
  return `${startText} – ${formatTime(end)}`;
}

/** Day of week (0 = Sunday) for "YYYY-MM-DD". */
export function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "YYYY-MM-DD" plus n days. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "Nov 14" */
export function formatMonthDay(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}

/** "Sat Nov 14" */
export function formatDate(date: string): string {
  return `${WEEKDAYS[weekday(date)]} ${formatMonthDay(date)}`;
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** "Saturday" */
export function weekdayName(date: string): string {
  return WEEKDAY_NAMES[weekday(date)];
}

/** "Today · Sat Nov 14", "Tomorrow · Sun Nov 15" or "Mon Nov 16". */
export function formatDayHeading(date: string, today: string): string {
  if (date === today) return `Today · ${formatDate(date)}`;
  if (date === addDays(today, 1)) return `Tomorrow · ${formatDate(date)}`;
  return formatDate(date);
}

/** "Today · 6:30 – 8:55 AM", "Tomorrow · …" or "Sat Nov 21 · …": short, so it fits on one line. */
export function sessionWhen(start: LocalDateTime, end: LocalDateTime, today: string): string {
  const date = start.slice(0, 10);
  const day = date === today ? "Today" : date === addDays(today, 1) ? "Tomorrow" : formatDate(date);
  return `${day} · ${formatTimeRange(start, end)}`;
}

/** "Tue Dec 30, 7 AM" */
export function formatDateTime(time: LocalDateTime): string {
  return `${formatDate(time.slice(0, 10))}, ${formatTime(time)}`;
}

/** "Nov 27, 7 AM" or "Nov 27, 7:30 AM": short enough to sit beside a button on a phone. */
export function formatShortDateTime(time: LocalDateTime): string {
  // A non-breaking space keeps "7 AM" together if it wraps.
  const clock = formatTime(time).replace(" ", "\u00a0");
  return `${formatMonthDay(time.slice(0, 10))}, ${clock}`;
}

const checkedFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TORONTO_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** An ISO timestamp as Toronto time, "3:42 p.m." -> "3:42 pm". */
export function formatCheckedAt(iso: string): string {
  return checkedFormat.format(new Date(iso)).replace(/\./g, "").replace(/\s+/g, " ").toLowerCase();
}

/** "Drop In Adult Pickleball" -> "Adult Pickleball" (the badge already says drop-in). */
export function displayTitle(title: string): string {
  return title.replace(/^drop[\s-]?in\s+/i, "").trim() || title;
}

/** Minutes from a to b, both Toronto wall-clock times. */
function minutesBetween(a: LocalDateTime, b: LocalDateTime): number {
  const ms = (t: LocalDateTime) => Date.parse(`${t.replace(" ", "T")}Z`);
  return (ms(b) - ms(a)) / 60_000;
}

/** How soon a session starts: under way, within 15 minutes, or within the hour. */
export type StartsTone = "now" | "soon" | "later";

/** "On now" or "Starts in 25 min" (within the hour) with its tone, or null. */
export function startsLabel(
  start: LocalDateTime,
  end: LocalDateTime,
  now: LocalDateTime,
): { text: string; tone: StartsTone } | null {
  if (start <= now) return now < end ? { text: "On now", tone: "now" } : null;
  const minutes = Math.ceil(minutesBetween(now, start));
  if (minutes > 60) return null;
  return { text: `Starts in ${minutes} min`, tone: minutes <= 15 ? "soon" : "later" };
}
