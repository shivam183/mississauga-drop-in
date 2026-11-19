/**
 * Schedule service: loads sessions for both calendars in small batches and
 * caches the normalised result packed by activity (the raw calendar 1 response
 * is ~12 MB; the packed sessions are well under 1 MB). Server-side only.
 */
import { cacheLife, cacheTag } from "next/cache";
import { getActiveNetClient } from "@/lib/activenet";
import type { CalendarId } from "@/lib/activenet/types";
import { CENTRES_BY_TYPE, type Centre } from "@/lib/centres";
import { secondsUntilTorontoHour } from "@/lib/dates";
import {
  CALENDAR_FOR_TYPE,
  normalizeEvents,
  packSessions,
  unpackSessions,
  type PackedActivity,
  type Session,
  type SessionType,
} from "@/models/session";

/** Centres per events request. Keeps calendar 1 responses to ~2–3 MB each. */
export const CENTRES_PER_REQUEST = 5;

/**
 * One batch of centres for one calendar, packed. Not cached on its own: the
 * merged list below is, so caching each batch too only doubled the cache writes.
 */
export async function getCentreBatch(
  calendar: CalendarId,
  centreIds: readonly number[],
): Promise<PackedActivity[]> {
  const body = await getActiveNetClient().getEvents(calendar, centreIds);
  return packSessions(normalizeEvents(body, calendar));
}

export interface Schedule {
  /** Sorted by start time. Includes sessions earlier this week; filter with filterSessions. */
  sessions: Session[];
  /** Centres whose sessions couldn't be loaded, so the page can say so. */
  failedCentres: Centre[];
}

function batches<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Sessions of the given types (default both), merged into one list. The merged
 * list is cached too, so a page render or API call is one cache read instead
 * of one per batch plus a merge and sort. A list with failed centres is only
 * kept for a minute so they're retried soon.
 */
/**
 * Refreshed once a day, at 7 am Toronto time (the first request after 7 gets the
 * old list and starts the refresh); ended sessions are hidden at render time anyway.
 * A list with failed centres is kept a minute so they're retried soon.
 */
function scheduleLifetime(failed: boolean) {
  if (failed) return cacheLife("minutes");
  const untilSeven = secondsUntilTorontoHour(7, new Date());
  cacheLife({ stale: 300, revalidate: untilSeven, expire: untilSeven + 86_400 });
}

export async function getSchedule(
  types: readonly SessionType[] = ["dropin", "enroll"],
): Promise<Schedule> {
  // This instance's memory first (free), the remote cache (billed per read) only on
  // a miss.
  "use cache";
  cacheTag("schedule");
  const { packed, failedCentres } = await remoteSchedule(types);
  // The same lifetime as the remote copy. Without its own cacheLife this layer would
  // use Next's 15-minute default (a longer inner lifetime doesn't carry over), re-reading
  // the whole schedule from the remote cache four times an hour per instance.
  scheduleLifetime(failedCentres.length > 0);
  return { sessions: unpackSessions(packed), failedCentres };
}

async function remoteSchedule(
  types: readonly SessionType[],
): Promise<{ packed: PackedActivity[]; failedCentres: Centre[] }> {
  "use cache: remote";
  cacheTag("schedule");
  const jobs = types.flatMap((type) =>
    batches(CENTRES_BY_TYPE[type], CENTRES_PER_REQUEST).map((centres) => ({ type, centres })),
  );
  const results = await Promise.allSettled(
    jobs.map(({ type, centres }) =>
      getCentreBatch(
        CALENDAR_FOR_TYPE[type],
        centres.map((c) => c.id),
      ),
    ),
  );

  const lists: PackedActivity[][] = [];
  const failed = new Map<number, Centre>();
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      lists.push(result.value);
    } else {
      const { type, centres } = jobs[i];
      console.error(
        `[schedule] ${type} batch failed for centres ${centres.map((c) => c.id).join(",")}:`,
        result.reason instanceof Error ? result.reason.message : result.reason,
      );
      for (const centre of centres) failed.set(centre.id, centre);
    }
  });

  scheduleLifetime(failed.size > 0);
  // Batches cover different centres, so concatenating is enough; unpackSessions sorts.
  return { packed: lists.flat(), failedCentres: [...failed.values()] };
}
