/**
 * Details for one activity (the details popup and page): its upcoming
 * sessions from the schedule plus the City's description, ages and centre,
 * cached for a day. Only activities with an upcoming session are looked up,
 * so the route can't be used to query the City for arbitrary ids.
 * Server-side only.
 */
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { cache } from "react";
import { getActiveNetClient } from "@/lib/activenet";
import { getCachedDetail } from "@/lib/availability";
import { toTorontoLocal } from "@/lib/dates";
import { getSchedule } from "@/lib/schedule";
import { toActivityInfo, type ActivityInfo } from "@/models/activity";
import type { Session } from "@/models/session";

async function remoteInfo(activityId: number): Promise<ActivityInfo> {
  "use cache: remote"; // shared across Vercel instances; about 1–2 KB
  cacheLife("info");
  cacheTag("info", `info-${activityId}`);
  const { detail } = await getActiveNetClient().getActivityDetail(activityId);
  if (detail.activity_id !== activityId) {
    throw new Error(`detail for ${activityId} returned activity ${detail.activity_id}`);
  }
  return toActivityInfo(detail);
}

/** This instance's memory first (free), the remote cache (billed per read) only on a miss. */
async function getActivityInfo(activityId: number): Promise<ActivityInfo> {
  "use cache";
  cacheTag("info", `info-${activityId}`);
  return remoteInfo(activityId);
}

/**
 * One activity's sessions (ended ones included), so an open doesn't scan the
 * whole schedule. Memory only: it's derived from the cached schedule.
 */
async function activitySessions(activityId: number): Promise<Session[]> {
  "use cache";
  cacheTag("schedule");
  const { sessions } = await getSchedule();
  return sessions.filter((s) => s.activityId === activityId);
}

/**
 * An enroll-online session is its own activity, and its spots lookup already
 * fetches the same City detail (cached 60 s), so build the info from that.
 */
async function infoFor(session: Session): Promise<ActivityInfo> {
  if (session.type === "enroll") {
    return toActivityInfo((await getCachedDetail(session.activityId)).body.detail);
  }
  return getActivityInfo(session.activityId);
}

export interface Activity {
  /** Upcoming (or under way) sessions, by start time. Never empty. */
  sessions: Session[];
  /** Null if the City's details couldn't be loaded; the sessions still show. */
  info: ActivityInfo | null;
  /** Toronto time now, for "On now". */
  now: string;
}

/**
 * An activity with an upcoming session, or null (unknown, ended, or not a valid
 * id). Per request, so the page's metadata and body share one lookup.
 */
export const getActivity = cache(async (activityId: number): Promise<Activity | null> => {
  if (!Number.isSafeInteger(activityId) || activityId <= 0) return null;
  const sessions = await activitySessions(activityId);
  // "Now" must come from the request, never a prerender.
  await connection();
  const now = toTorontoLocal(new Date());
  const upcoming = sessions.filter((s) => s.end > now);
  if (upcoming.length === 0) return null;
  const info = await infoFor(upcoming[0]).catch((error: unknown) => {
    console.error(
      `[activity] details failed for ${activityId}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  });
  return { sessions: upcoming, info, now };
});
