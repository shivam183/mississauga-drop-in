/**
 * Registered programs (swim lessons, camps, leagues…): what the /registered list
 * and its popup show, read from the City's activity search. Plain data, so it
 * can be cached. Also the /registered URL state and its search pattern.
 */
import type {
  ActivitySearchPattern,
  EstimatePriceBody,
  LocalDateTime,
  MeetingDatesBody,
  RawProgram,
} from "@/lib/activenet/types";
import { displayTitle, formatMonthDay, formatTimeRange } from "@/lib/format";
import type { RawSearchParams } from "@/lib/params";
import { formatAges } from "./activity";
import { FEW_SPACES } from "./availability";
import { cityDates, cityWeekdays, type CalendarPattern } from "./calendar";
import { noticeToText, safeCityUrl } from "./links";

export interface Program {
  id: number;
  name: string;
  centre: string;
  /** "Mon, Wed", or empty. */
  days: string;
  /** "6:30 – 7:30 PM", or empty. */
  time: string;
  /** "Jan 4 – Mar 8", or one date for a one-day program. */
  dates: string;
  /** "At least 9 but less than 13" as the City words it; empty if unknown. */
  ages: string;
  status: ProgramStatus;
  /** Already under way (the City says "In progress"); you can often still join. */
  started: boolean;
  /** The City's enroll page, or null. */
  enrollUrl: string | null;
  /** The City's page for the program, or null. */
  cityUrl: string | null;
}

export type ProgramStatus =
  | { state: "open"; spots: number; few: boolean }
  | { state: "full" }
  /** Online registration opens at `at` (Toronto time); `spots` are open now. */
  | { state: "opens"; at: LocalDateTime; spots: number; few: boolean };

const text = (value: unknown) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
const isoDate = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";

/** "6:30 PM - 7:30 PM" -> "6:30 – 7:30 PM"; "11:00 AM - Noon" -> "11 AM – 12 PM" (no ":00", as formatTimeRange). */
export function formatCityTimeRange(raw: string): string {
  const [a, b] = text(raw)
    .replace(/\bNoon\b/i, "12:00 PM")
    .replace(/:00\b/g, "")
    .split(/\s+-\s+/);
  if (!a || !b) return text(raw);
  const sameHalf = a.slice(-2) === b.slice(-2);
  return `${sameHalf ? a.slice(0, -3) : a} – ${b}`;
}

/** "2027-01-04", "2027-03-08" -> "Jan 4 – Mar 8"; one date when they match or there's no end. */
export function formatDateSpan(start: string, end: string): string {
  if (!start) return "";
  if (!end || end === start) return formatMonthDay(start);
  return `${formatMonthDay(start)} – ${formatMonthDay(end)}`;
}

export function programStatus(row: RawProgram, now: LocalDateTime): ProgramStatus {
  if (/^full$/i.test(text(row.urgent_message?.status_description)) || row.total_open <= 0) {
    return { state: "full" };
  }
  const opens = text(row.activity_online_start_time);
  const few = row.total_open <= FEW_SPACES;
  if (opens && opens > now) return { state: "opens", at: opens, spots: row.total_open, few };
  return { state: "open", spots: row.total_open, few };
}

export function toProgram(row: RawProgram, now: LocalDateTime): Program {
  return {
    id: row.id,
    name: displayTitle(text(row.name)),
    centre: text(row.location?.label),
    days: text(row.days_of_week).replace(/,\s*/g, ", "),
    time: formatCityTimeRange(row.time_range),
    dates: formatDateSpan(isoDate(row.date_range_start), isoDate(row.date_range_end)),
    // Decoded: the City sends "4&#189;" for 4½.
    ages: noticeToText(row.ages),
    status: programStatus(row, now),
    started: /^in progress$/i.test(text(row.urgent_message?.status_description)),
    enrollUrl: safeCityUrl(row.enroll_now?.href),
    cityUrl: safeCityUrl(row.detail_url),
  };
}

/**
 * "At least 9 but less than 13" -> "Ages 9–12"; "… less than 100" and "3 and up" -> "Ages 18+" / "Ages 3+".
 * "At least 4y 9m but less than 15" -> "Ages 4y 9m–14". Anything else as the City says it.
 */
export function agesLabel(ages: string): string {
  // The details page's formatter, so a card and its popup always agree.
  const short = formatAges(ages);
  return /^\d/.test(short) ? `Ages ${short}` : short;
}

// Fees ---------------------------------------------------------------------

export interface Fee {
  /** "Resident", "Non-resident"; empty when the City gives no label. */
  label: string;
  /** "$102.15" */
  price: string;
}

/**
 * The payment plan, typed by City staff: "Fall 50% now+50% Oct 5" ->
 * "50% now, 50% on Oct 5". Other wording is shown as the City wrote it; "" when none.
 */
export function paymentPlan(termName: unknown): string {
  const raw = noticeToText(termName);
  // The season name comes first ("Fall", "Winter"); the plan starts at the first percentage.
  const parts = raw.replace(/^[^\d]*(?=\d+\s*%)/, "").split(/\s*\+\s*/);
  const steps = parts.map((p) => /^(\d+)\s*%\s*(\S.*)$/.exec(p));
  if (parts.length < 2 || steps.some((s) => !s)) return raw;
  return steps.map((s) => `${s![1]}% ${/^now$/i.test(s![2]) ? "now" : `on ${s![2]}`}`).join(", ");
}

/** Fees from estimateprice: [] when unknown, [{ label: "", price: "Free" }] when free. */
export function toFees(body: EstimatePriceBody): Fee[] {
  const { free, prices } = body.estimateprice;
  if (free) return [{ label: "", price: "Free" }];
  return (prices ?? [])
    .flatMap((p) => p.details ?? [])
    .map((d) => ({ label: feeLabel(text(d.description)), price: text(d.price) }))
    .filter((f) => /^\$\d/.test(f.price));
}

/**
 * "Resident<br>Member of package:<br>All-in: …, Fit+: …" (dozens of packages)
 * -> "Resident, member", like the City's own "Resident, non-member".
 */
function feeLabel(description: string): string {
  const [first = "", ...rest] = description.split(/<br\s*\/?>/i);
  const label = noticeToText(first);
  return /member of package/i.test(rest.join(" ")) ? `${label}, member` : label;
}

// Meeting pattern -----------------------------------------------------------

/** One meeting pattern: when ("Weekdays · 9:00 AM – 12:00 PM") and its dates ("Mar 15 – Mar 19"). */
export interface Meeting {
  time: string;
  dates: string;
}

/** When a program meets, one per pattern. */
export function meetingLines(body: MeetingDatesBody): Meeting[] {
  const patterns = body.meeting_and_registration_dates.activity_patterns ?? [];
  return patterns.flatMap((p) => {
    const dates = formatDateSpan(isoDate(p.beginning_date), isoDate(p.ending_date));
    return (p.pattern_dates ?? []).map((d) => {
      const from = text(d.starting_time);
      const to = text(d.ending_time);
      // formatTimeRange reads the clock from "YYYY-MM-DD HH:MM:SS"; the date doesn't matter.
      const time =
        /^\d{2}:\d{2}/.test(from) && /^\d{2}:\d{2}/.test(to)
          ? formatTimeRange(`2000-01-01 ${from}`, `2000-01-01 ${to}`)
          : "";
      return { time: [text(d.weekdays), time].filter(Boolean).join(" · "), dates };
    });
  });
}

const clock = (value: unknown) =>
  typeof value === "string" && /^\d{2}:\d{2}:\d{2}$/.test(value) ? value : "";

/**
 * When a program meets, for its calendar file: one weekly pattern per weekday
 * set and time, and each extra one-off date. Parts with unknown days, dates or
 * times are left out rather than guessed.
 */
export function calendarPatterns(body: MeetingDatesBody): CalendarPattern[] {
  const dates = body.meeting_and_registration_dates;
  const weekly = (dates.activity_patterns ?? []).flatMap((p) => {
    const from = isoDate(p.beginning_date);
    const until = isoDate(p.ending_date);
    const except = (p.exception_dates ?? []).flatMap((raw) => cityDates(text(raw)));
    return (p.pattern_dates ?? []).flatMap((d) => {
      const days = cityWeekdays(text(d.weekdays));
      const start = clock(d.starting_time);
      const end = clock(d.ending_time);
      return days && from && until && start && end
        ? [{ days, from, until, start, end, except }]
        : [];
    });
  });
  const extra = (dates.additional_dates ?? []).flatMap((d) => {
    const date = isoDate(d.meeting_date);
    const start = clock(d.starting_time);
    const end = clock(d.ending_time);
    if (!date || !start || !end) return [];
    const day = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][
      new Date(`${date}T12:00:00Z`).getUTCDay()
    ];
    return [{ days: [day], from: date, until: date, start, end, except: [] }];
  });
  return [...weekly, ...extra];
}

// URL state ----------------------------------------------------------------

/** Days for the Day filter, Sunday first like the City's mask. */
export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** City pages shown at most ("Show more" adds one). */
export const MAX_PAGES = 10;
const MAX_QUERY_LENGTH = 100;

export interface ProgramSearch {
  q: string;
  /** A City category id ("48"), or null. */
  category: string | null;
  /** A City season id, "all", or null for the upcoming seasons (the default). */
  season: string | null;
  /** The participant's age in years, or null. */
  age: number | null;
  /** Days it meets on (any of them), Sunday first; empty for any day. */
  days: WeekdayKey[];
  centreIds: number[];
  /** Only programs with openings. */
  open: boolean;
  /** City pages to show (20 rows each). */
  pages: number;
}

/**
 * Quick picks under the search box. Like Drop-in's, a chip puts its word in the
 * box. Most stand for a City category (found by name, so a renumbered id still
 * works; a missing one is left out): a box holding just that word searches the
 * category, since a word search finds far fewer (Sports 476 vs "sport" 56,
 * Learning 65 vs "learn" none). Camps span three categories, so "camp" is a word.
 */
export const PROGRAM_CHIPS: Array<{
  label: string;
  icon: string;
  word: string;
  category?: string;
}> = [
  { label: "Swim lessons", icon: "🏊", word: "swim lessons", category: "Swimming Lessons" },
  { label: "Camps", icon: "🏕️", word: "camp" },
  { label: "Sports", icon: "🏀", word: "sports", category: "Sports" },
  { label: "Fitness", icon: "💪", word: "fitness", category: "Fitness" },
  { label: "Skating", icon: "⛸️", word: "skating", category: "Skating & Hockey" },
  { label: "Dance & music", icon: "💃", word: "dance & music", category: "Dance, Drama, Music" },
  { label: "Arts", icon: "🎨", word: "arts", category: "Arts" },
  { label: "Leagues", icon: "🏆", word: "leagues", category: "Sport Leagues" },
  { label: "Learning", icon: "📚", word: "learning", category: "Learning" },
];

type Categories = Array<{ id: string; label: string }> | undefined;

/** A chip's City category id, by name; undefined for a word chip or a category the City dropped. */
export const chipCategoryId = (category: string | undefined, categories: Categories) =>
  category ? categories?.find((c) => c.label === category)?.id : undefined;

/** The search to run: a box holding just a category chip's word searches that category. */
export function chipSearch(state: ProgramSearch, categories: Categories): ProgramSearch {
  const word = state.q.trim().toLowerCase();
  const id = chipCategoryId(PROGRAM_CHIPS.find((c) => c.word === word)?.category, categories);
  return id ? { ...state, q: "", category: id } : state;
}

export const EMPTY_PROGRAM_SEARCH: ProgramSearch = {
  q: "",
  category: null,
  season: null,
  age: null,
  days: [],
  centreIds: [],
  open: false,
  pages: 1,
};

function firstValue(params: RawSearchParams, key: string): string {
  const raw = params[key];
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

/** Reads /registered's URL; anything invalid is ignored. */
export function parseProgramParams(params: RawSearchParams): ProgramSearch {
  const q = firstValue(params, "q").replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
  const category = firstValue(params, "cat");
  const season = firstValue(params, "season");
  const age = Number(firstValue(params, "age"));
  // "tue,thu" from a link, or day=tue&day=thu from the form's day buttons.
  const rawDays = params.day;
  const dayList = (Array.isArray(rawDays) ? rawDays : [rawDays ?? ""])
    .flatMap((v) => v.toLowerCase().split(","))
    .map((v) => v.trim());
  const pages = Number(firstValue(params, "pages"));
  const rawCentres = params.centre;
  const centreIds = (Array.isArray(rawCentres) ? rawCentres : [rawCentres ?? ""])
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v) => /^\d{1,6}$/.test(v))
    .map(Number);
  return {
    q,
    category: /^\d{1,6}$/.test(category) ? category : null,
    season: /^\d{1,6}$/.test(season) || season === "all" ? season : null,
    // 1 to 99; 0 (no one is 0) or anything else means all ages.
    age: Number.isInteger(age) && age >= 1 && age <= 99 ? age : null,
    days: WEEKDAY_KEYS.filter((d) => dayList.includes(d)),
    centreIds: [...new Set(centreIds)].sort((a, b) => a - b).slice(0, 20),
    open: firstValue(params, "open") === "1",
    pages: Number.isInteger(pages) && pages > 1 ? Math.min(pages, MAX_PAGES) : 1,
  };
}

export function programQueryString(state: ProgramSearch): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.category) params.set("cat", state.category);
  if (state.season) params.set("season", state.season);
  if (state.age !== null) params.set("age", String(state.age));
  if (state.days.length) params.set("day", state.days.join(","));
  if (state.centreIds.length) params.set("centre", state.centreIds.join(","));
  if (state.open) params.set("open", "1");
  if (state.pages > 1) params.set("pages", String(state.pages));
  return params.toString();
}

/** /registered with one thing changed. Any filter change starts again at the first page. */
export function programHref(state: ProgramSearch, changes: Partial<ProgramSearch>): string {
  const next = { ...state, pages: 1, ...changes };
  const query = programQueryString(next);
  return query ? `/registered?${query}` : "/registered";
}

export function activeProgramFilterCount(state: ProgramSearch): number {
  // Not the category: it's what you're looking for (a chip), like the search text.
  // Nor the default upcoming seasons (season null).
  return [
    state.season,
    state.age !== null,
    state.days.length,
    state.centreIds.length,
    state.open,
  ].filter(Boolean).length;
}

/**
 * The City's search pattern for this state. `typeIds` are the non-drop-in
 * types; `upcomingIds` the seasons searched by default (none: every season).
 */
export function toSearchPattern(
  state: ProgramSearch,
  typeIds: string[],
  upcomingIds: string[] = [],
): ActivitySearchPattern {
  return {
    // Lower case, so "Swim" and "swim" share a cache entry (the City ignores case).
    activity_keyword: state.q.toLowerCase(),
    center_ids: state.centreIds.map(String),
    activity_category_ids: state.category ? [state.category] : [],
    season_ids:
      state.season === "all" ? [] : state.season ? [state.season] : [...upcomingIds].sort(),
    activity_type_ids: typeIds,
    // The City matches any of the days marked.
    days_of_week: state.days.length
      ? WEEKDAY_KEYS.map((d) => (state.days.includes(d) ? "1" : "0")).join("")
      : null,
    min_age: state.age,
    max_age: state.age,
    open_spots: state.open ? 1 : null,
  };
}

/** Types in the activity search that aren't drop-ins (those are on the Drop-in tab). */
export function programTypeIds(types: Array<{ id: string; desc: string }>): string[] {
  return types.filter((t) => !isDropInType(t.desc)).map((t) => t.id);
}

/** "Drop In Program", "Drop-in": those are on the Drop-in tab, not here. */
export function isDropInType(type: string): boolean {
  return /drop[\s-]*in/i.test(type);
}

// Seasons ------------------------------------------------------------------

/** What the Season filter knows about a season: its programs and when they start. */
export interface SeasonInfo {
  count: number;
  /** The earliest program's first day, "2027-01-02"; "" when unknown. */
  start: string;
  /** When registration opens for that program, "2026-11-24 07:00:00"; "" when unknown. */
  opens: string;
}

/** Days a season can have been running and still count as upcoming (late sign-ups). */
const UPCOMING_GRACE_DAYS = 14;

/** Seasons with programs that haven't started, or started in the last two weeks. `now` is Toronto time. */
export function upcomingSeasonIds(info: Record<string, SeasonInfo>, now: string): string[] {
  const cutoff = new Date(`${now.slice(0, 10)}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - UPCOMING_GRACE_DAYS);
  const from = cutoff.toISOString().slice(0, 10);
  return Object.entries(info)
    .filter(([, s]) => s.count > 0 && s.start >= from)
    .map(([id]) => id);
}

/** "registration opens Nov 24", "starts Jan 2" or "in progress", for the Season filter. */
export function seasonStatus(info: SeasonInfo, now: string): string {
  if (info.opens > now) return `registration opens ${formatMonthDay(info.opens.slice(0, 10))}`;
  if (info.start > now.slice(0, 10)) return `starts ${formatMonthDay(info.start)}`;
  return info.start ? "in progress" : "";
}
