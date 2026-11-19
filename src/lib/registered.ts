/**
 * Registered programs, searched live on the City's activity search (one
 * request per page of 20, with the filters done on their side) instead of
 * copying all ~9,600. Server-side only.
 *
 * Caching (see PLAN, Hosting limits):
 * - Search pages and program details: this instance's memory only, 10 minutes.
 *   Every filter combination is its own entry, too many to write to the
 *   Runtime Cache, and spots change.
 * - Filter lists and season info: memory, then the Runtime Cache
 *   ("remote"), a day. They're small (under 8 KB, one read unit), change at
 *   most each season, and a cold instance would otherwise repeat them: about
 *   16 City requests for the lists and counts.
 * - Errors are never cached, so a failed lookup is retried by the next request.
 *   (A program's extras, fees, meeting times and enroll status, are left out of
 *   its popup for those 10 minutes if only they fail.)
 */
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { cache } from "react";
import { getActiveNetClient } from "@/lib/activenet";
import { PROGRAMS_PER_PAGE } from "@/lib/activenet/client";
import type { ActivitySearchPattern, RawProgram } from "@/lib/activenet/types";
import { toTorontoLocal } from "@/lib/dates";
import { toActivityInfo, type ActivityInfo } from "@/models/activity";
import {
  toEnrollState,
  toSessionStatus,
  type EnrollState,
  type Spaces,
} from "@/models/availability";
import { noticeToText } from "@/models/links";
import {
  EMPTY_PROGRAM_SEARCH,
  isDropInType,
  meetingLines,
  paymentPlan,
  programTypeIds,
  toFees,
  toProgram,
  toSearchPattern,
  upcomingSeasonIds,
  type Fee,
  type Meeting,
  type Program,
  type ProgramSearch,
  type SeasonInfo,
} from "@/models/registered";

const CITY_SITE = "https://anc.ca.apm.activecommunities.com/activemississauga";

/** The City's own page for a program (and where Enroll ends up). */
export const programCityUrl = (id: number) =>
  `${CITY_SITE}/activity/search/detail/${id}?onlineSiteId=0&locale=en-US`;
const programEnrollUrl = (id: number) => `${CITY_SITE}/activity/search/enroll/${id}?locale=en-US`;

export interface ProgramOptions {
  centres: Array<{ id: number; name: string }>;
  categories: Array<{ id: string; label: string }>;
  /** Every season the City lists, past ones and empty ones too; see getSeasonCounts. */
  seasons: Array<{ id: string; label: string }>;
  /** Activity types that aren't drop-ins. */
  typeIds: string[];
}

async function remoteOptions(): Promise<ProgramOptions> {
  "use cache: remote"; // shared across instances; about 5 KB
  cacheLife("info");
  cacheTag("programs");
  const body = await getActiveNetClient().getActivityFilters();
  const typeIds = programTypeIds(body.types);
  // Without types the search would also return every drop-in.
  if (typeIds.length === 0) throw new Error("activity search lists no program types");
  return {
    centres: body.centers
      .map((c) => ({ id: Number(c.id), name: noticeToText(c.desc) }))
      .filter((c) => Number.isInteger(c.id) && c.id > 0 && c.name)
      .sort((a, b) => a.name.localeCompare(b.name)),
    categories: body.categories
      .map((c) => ({ id: c.id, label: noticeToText(c.desc) }))
      .filter((c) => /^\d+$/.test(c.id) && c.label)
      .sort((a, b) => a.label.localeCompare(b.label)),
    seasons: (body.seasons ?? [])
      .filter((s) => /^\d+$/.test(s.id) && !/template/i.test(s.desc))
      .map((s) => ({ id: s.id, label: noticeToText(s.desc) })),
    typeIds,
  };
}

/** The search's lists and program types: one City request a day. Memory first, then remote. */
export async function getProgramOptions(): Promise<ProgramOptions> {
  "use cache";
  // Its own lifetime: without one an outer cache refreshes every 15 minutes (Next's default).
  cacheLife("info");
  cacheTag("programs");
  return remoteOptions();
}

async function remoteSeasonInfo(
  seasonIds: string[],
  typeIds: string[],
): Promise<Record<string, SeasonInfo>> {
  "use cache: remote"; // shared across instances; under 1 KB
  cacheLife("info");
  cacheTag("programs");
  // Any failure throws, so a count of 0 is never cached for a season that has programs.
  const info = await Promise.all(
    seasonIds.map(async (season): Promise<SeasonInfo> => {
      const pattern = toSearchPattern({ ...EMPTY_PROGRAM_SEARCH, season }, typeIds);
      // Sorted by start date, so the first row is the season's earliest program.
      const { items, total } = await getActiveNetClient().searchActivities(pattern, 1);
      const first = items[0];
      const start = first?.date_range_start ?? "";
      const opens = first?.activity_online_start_time ?? "";
      return {
        count: total,
        start: /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : "",
        opens: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(opens) ? opens : "",
      };
    }),
  );
  return Object.fromEntries(seasonIds.map((id, i) => [id, info[i]]));
}

/**
 * Each season's program count and earliest start, for the Season filter (the
 * City lists empty seasons too) and the default "upcoming seasons" search.
 * One small request per season, once a day.
 */
export async function getSeasonInfo(
  seasonIds: string[],
  typeIds: string[],
): Promise<Record<string, SeasonInfo>> {
  "use cache";
  cacheLife("info"); // see getProgramOptions
  cacheTag("programs");
  return remoteSeasonInfo(seasonIds, typeIds);
}

/** Only what toProgram reads: about a fifth of the City's row, so memory holds more pages. */
function slim(row: RawProgram): RawProgram {
  return {
    id: row.id,
    name: row.name,
    location: { label: row.location.label },
    days_of_week: row.days_of_week,
    time_range: row.time_range,
    date_range_start: row.date_range_start,
    date_range_end: row.date_range_end,
    ages: row.ages,
    total_open: row.total_open,
    activity_online_start_time: row.activity_online_start_time,
    enroll_now: row.enroll_now?.href ? { href: row.enroll_now.href } : null,
    urgent_message: { status_description: row.urgent_message?.status_description ?? "" },
    detail_url: row.detail_url ?? null,
  };
}

/** One page of results. Memory only, ten minutes, so spots stay close to live. */
async function searchPage(
  pattern: ActivitySearchPattern,
  page: number,
): Promise<{ items: RawProgram[]; total: number }> {
  "use cache";
  cacheLife("enroll");
  cacheTag("programs");
  const { items, total } = await getActiveNetClient().searchActivities(pattern, page);
  return { items: items.map(slim), total };
}

export interface ProgramResults {
  programs: Program[];
  /** All matches on the City's side. */
  total: number;
  /** The seasons searched by default (no season picked); empty when every season was. */
  upcomingIds: string[];
}

/**
 * The seasons searched when none is picked: those starting soon or started in
 * the last two weeks. Every season if the season info can't be had.
 */
async function upcomingSeasons(options: ProgramOptions, now: string): Promise<string[]> {
  const info = await getSeasonInfo(
    options.seasons.map((s) => s.id),
    options.typeIds,
  ).catch(() => null);
  return info ? upcomingSeasonIds(info, now) : [];
}

/** Programs matching `search`, its first `search.pages` pages (each cached on its own). */
export async function searchPrograms(search: ProgramSearch): Promise<ProgramResults> {
  // "Now" (upcoming seasons, "Registration opens …") must come from the request, never a prerender.
  await connection();
  const now = toTorontoLocal(new Date());
  const options = await getProgramOptions();
  const upcomingIds = search.season === null ? await upcomingSeasons(options, now) : [];
  const pattern = toSearchPattern(search, options.typeIds, upcomingIds);
  const pages = await Promise.all(
    Array.from({ length: search.pages }, (_, i) => searchPage(pattern, i + 1)),
  );
  // A program can move between pages while they're cached apart; show it once.
  const seen = new Set<number>();
  const programs = pages
    .flatMap((p) => p.items)
    .filter((row) => !seen.has(row.id) && seen.add(row.id))
    .map((row) => toProgram(row, now));
  return { programs, total: pages[0]?.total ?? 0, upcomingIds };
}

/** Whether there are more results after `search.pages` pages. */
export const hasMorePages = (results: ProgramResults, pages: number) =>
  results.total > pages * PROGRAMS_PER_PAGE;

/** Detail, enroll status, meeting pattern and fees for one program. Ten minutes, for the spots. */
async function programDetail(id: number) {
  "use cache";
  cacheLife("enroll");
  cacheTag("programs", `program-${id}`);
  const client = getActiveNetClient();
  // Meetings and fees don't need the detail, so they start with it. They may fail
  // on their own; the popup then leaves that part out.
  const meetingsAsked = client
    .getMeetingDates(id)
    .then(meetingLines)
    .catch((): Meeting[] => []);
  const feesAsked = client
    .getEstimatePrice(id)
    .then(toFees)
    .catch((): Fee[] => []);
  const body = await client.getActivityDetail(id);
  const { detail } = body;
  if (detail.activity_id !== id) {
    throw new Error(`detail for ${id} returned activity ${detail.activity_id}`);
  }
  const firstDate = /^\d{4}-\d{2}-\d{2}$/.test(detail.first_date ?? "") ? detail.first_date! : "";
  const [button, meetings, fees] = await Promise.all([
    // The button status doesn't depend on the date for a program; it only has to look like one.
    firstDate
      ? client.getButtonStatus(id, `${firstDate} 00:00:00`).catch(() => null)
      : Promise.resolve(null),
    meetingsAsked,
    feesAsked,
  ]);
  return {
    type: typeof detail.activity_type === "string" ? detail.activity_type : "",
    info: toActivityInfo(detail),
    status: toSessionStatus(id, body, button, new Date()),
    meetings,
    fees,
    plan: paymentPlan(detail.term_name),
  };
}

export interface ProgramDetails {
  id: number;
  info: ActivityInfo;
  /** One per pattern: "Weekdays · 9:00 AM – 12:00 PM", "Mar 15 – Mar 19". */
  meetings: Meeting[];
  fees: Fee[];
  /** "50% now, 50% on Oct 5"; "" when none. */
  plan: string;
  spaces: Spaces;
  enroll: EnrollState;
  cityUrl: string;
}

/**
 * One program for its popup and page, or null: not a number, unknown, a
 * drop-in (those have their own page) or over. Per request, so the page's
 * metadata and body share one lookup. Every id that gets this far costs one
 * throttled City request a day at most (2 per second for the whole server).
 */
export const getProgram = cache(async (id: number): Promise<ProgramDetails | null> => {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  let detail: Awaited<ReturnType<typeof programDetail>>;
  try {
    detail = await programDetail(id);
  } catch (error) {
    console.warn(
      `[programs] no details for ${id}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
  await connection(); // "now" comes from the request, never a prerender
  const now = toTorontoLocal(new Date());
  const { info, status, type, meetings, fees, plan } = detail;
  if (isDropInType(type)) return null;
  if (info.lastDate && info.lastDate < now.slice(0, 10)) return null;
  // Registration that hasn't opened yet comes without a link; Enroll is the usual page then.
  const enroll = toEnrollState(
    status.opensAt && !status.enrollUrl ? { ...status, enrollUrl: programEnrollUrl(id) } : status,
    now,
  );
  return {
    id,
    info,
    meetings,
    fees,
    plan,
    spaces: status.spaces,
    enroll,
    cityUrl: programCityUrl(id),
  };
});
