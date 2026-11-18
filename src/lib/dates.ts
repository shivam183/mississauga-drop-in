import type { LocalDateTime } from "./activenet/types";

export const TORONTO_TIME_ZONE = "America/Toronto";

// The sv-SE locale formats as "YYYY-MM-DD HH:mm:ss", the API's own format.
const torontoFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TORONTO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** An instant as Toronto wall-clock time, in the API's "YYYY-MM-DD HH:mm:ss" format. */
export function toTorontoLocal(instant: Date): LocalDateTime {
  return torontoFormat.format(instant);
}

/** Seconds from `now` until the next `hour`:00 in Toronto (a full day if it's that time now). */
// shortcut: on the two days a year the clocks change, the refresh lands an hour off; fine for a daily refresh.
export function secondsUntilTorontoHour(hour: number, now: Date): number {
  const [h, m, s] = toTorontoLocal(now).slice(11).split(":").map(Number);
  const DAY = 86_400;
  return (hour * 3600 - (h * 3600 + m * 60 + s) + DAY) % DAY || DAY;
}
