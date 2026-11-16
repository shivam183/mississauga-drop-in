/**
 * Schedule service: loads sessions for both calendars in small batches and
 * caches the normalised result (the raw calendar 1 response is ~12 MB, so
 * only the small Session objects are cached). Server-side only.
 */
import { cacheLife, cacheTag } from "next/cache";
import { getActiveNetClient } from "@/lib/activenet";
import type { CalendarId } from "@/lib/activenet/types";
import { CENTRES_BY_TYPE, type Centre } from "@/lib/centres";
import {
  CALENDAR_FOR_TYPE,
  mergeSessions,
  normalizeEvents,
  type Session,
  type SessionType,
} from "@/models/session";

/** Centres per events request. Keeps calendar 1 responses to ~2–3 MB each. */
export const CENTRES_PER_REQUEST = 5;

/** One batch of centres for one calendar, cached for 10 minutes. */
export async function getCentreBatch(
  calendar: CalendarId,
  centreIds: readonly number[],
): Promise<Session[]> {
  "use cache: remote"; // shared across Vercel instances
  cacheLife("schedule");
  cacheTag("schedule", `schedule-${calendar}`);
  const body = await getActiveNetClient().getEvents(calendar, centreIds);
  return normalizeEvents(body, calendar);
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
export async function getSchedule(
  types: readonly SessionType[] = ["dropin", "enroll"],
): Promise<Schedule> {
  // This instance's memory first (free), the remote cache (billed per read) only on
  // a miss. No cacheLife here, so the shorter lifetime after a failure carries over.
  "use cache";
  cacheTag("schedule");
  return remoteSchedule(types);
}

async function remoteSchedule(types: readonly SessionType[]): Promise<Schedule> {
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

  const lists: Session[][] = [];
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

  // shortcut: the merged list can be up to one schedule lifetime older than its batches
  // (each is cached separately), so schedules may lag ~20 min at worst. Fine for timetables.
  if (failed.size) cacheLife("minutes");
  else cacheLife("schedule");
  return { sessions: mergeSessions(...lists), failedCentres: [...failed.values()] };
}
