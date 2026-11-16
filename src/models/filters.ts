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
  /** Only this session (Session.id), e.g. from a shared link. */
  sessionId?: string;
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
  return hour < TIME_OF_DAY_HOURS.morning[1]
    ? "morning"
    : hour < TIME_OF_DAY_HOURS.afternoon[1]
      ? "afternoon"
      : "evening";
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
    if (filters.sessionId && s.id !== filters.sessionId) return false;
    if (filters.type && s.type !== filters.type) return false;
    if (centres && !centres.has(s.centreId)) return false;
    const day = s.start.slice(0, 10);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    if (times && !times.has(timeOfDay(s.start))) return false;
    if (words.length > 0 && !words.every((w) => s.searchText.includes(w))) return false;
    return true;
  });
}

export interface DayGroup {
  /** "YYYY-MM-DD" */
  date: string;
  sessions: Session[];
}

export interface PageDay extends DayGroup {
  /** Collapsed: shown as a heading only, with no sessions. */
  collapsed: boolean;
}

/** Sessions of the next day shown after a page that holds only one open day. */
export const NEXT_DAY_PREVIEW = 5;

/**
 * One page of results by day: up to `limit` sessions from days that aren't
 * collapsed, plus a heading for each collapsed day among them. Collapsed days
 * don't use up the page, so collapsing one brings in the next sessions.
 *
 * A page that's all one open day also shows the start of the next open day,
 * so collapsing that day reveals cards at once instead of a blank screen.
 * Input should be sorted.
 */
export function pageDays(
  sessions: readonly Session[],
  limit: number,
  collapsed: readonly string[],
): { days: PageDay[]; shown: number; more: boolean } {
  const hidden = new Set(collapsed);
  const days: PageDay[] = [];
  let shown = 0;
  const add = (session: Session) => {
    const date = session.start.slice(0, 10);
    let day = days.at(-1);
    if (day?.date !== date) days.push((day = { date, sessions: [], collapsed: hidden.has(date) }));
    if (!day.collapsed) {
      day.sessions.push(session);
      shown++;
    }
  };

  let i = 0;
  for (; i < sessions.length && shown < limit; i++) add(sessions[i]);

  const open = days.filter((d) => !d.collapsed);
  if (open.length === 1) {
    const long = open[0].date;
    let next: string | null = null;
    let previewed = 0;
    for (; i < sessions.length && previewed < NEXT_DAY_PREVIEW; i++) {
      const date = sessions[i].start.slice(0, 10);
      if (date === long) continue; // the rest of the long day stays behind "Show more"
      if (!hidden.has(date)) {
        if (next !== null && date !== next) break; // only the next open day
        next = date;
        previewed++;
      }
      add(sessions[i]);
    }
  }

  const openTotal = sessions.filter((s) => !hidden.has(s.start.slice(0, 10))).length;
  return { days, shown, more: shown < openTotal };
}
