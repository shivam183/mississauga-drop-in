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
