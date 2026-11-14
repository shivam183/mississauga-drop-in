import type { LocalDateTime } from "@/lib/activenet/types";
import type { Session, SessionType } from "./session";

export type TimeOfDay = "morning" | "afternoon" | "evening";

/** Start hour ranges: morning before noon, afternoon noon–5 pm, evening from 5 pm. */
export const TIME_OF_DAY_HOURS: Record<TimeOfDay, [from: number, to: number]> = {
  morning: [0, 12],
  afternoon: [12, 17],
  evening: [17, 24],
};

export interface SessionFilters {
  /** Free text; every word must appear in the title, centre or room. */
  q?: string;
  type?: SessionType;
  centreIds?: readonly number[];
  /** Inclusive dates, "YYYY-MM-DD". */
  from?: string;
  to?: string;
  timesOfDay?: readonly TimeOfDay[];
}

/** Lower-case and strip accents, so "Zumba®" or "Café" match plain typing. */
export function foldText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function timeOfDay(start: LocalDateTime): TimeOfDay {
  const hour = Number(start.slice(11, 13));
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

/**
 * Applies the filters and drops sessions that have already ended. `now` is
 * Toronto local time in the API's format (see toTorontoLocal).
 */
export function filterSessions(
  sessions: readonly Session[],
  filters: SessionFilters,
  now: LocalDateTime,
): Session[] {
  const words = filters.q ? foldText(filters.q).split(" ").filter(Boolean) : [];
  const centres = filters.centreIds?.length ? new Set(filters.centreIds) : null;
  const times = filters.timesOfDay?.length ? new Set(filters.timesOfDay) : null;

  return sessions.filter((s) => {
    if (s.end <= now) return false;
    if (filters.type && s.type !== filters.type) return false;
    if (centres && !centres.has(s.centreId)) return false;
    const day = s.start.slice(0, 10);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    if (times && !times.has(timeOfDay(s.start))) return false;
    if (words.length > 0) {
      const haystack = foldText(`${s.title} ${s.centreName} ${s.facility}`);
      if (!words.every((w) => haystack.includes(w))) return false;
    }
    return true;
  });
}

export interface DayGroup {
  /** "YYYY-MM-DD" */
  date: string;
  sessions: Session[];
}

/** Groups sessions by start date, keeping their order. Input should be sorted. */
export function groupByDay(sessions: readonly Session[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const session of sessions) {
    const date = session.start.slice(0, 10);
    const last = groups.at(-1);
    if (last?.date === date) last.sessions.push(session);
    else groups.push({ date, sessions: [session] });
  }
  return groups;
}
