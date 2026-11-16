/**
 * Availability service for "enroll online" sessions: spots left (cached 60 s)
 * and the enroll link and opening time (cached 10 min). Only ids of real
 * calendar 3 sessions are looked up, so callers can't make us query anything
 * else. Server-side only.
 */
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { getActiveNetClient } from "@/lib/activenet";
import type { ActivityDetailBody, ButtonStatusBody, LocalDateTime } from "@/lib/activenet/types";
import { toTorontoLocal } from "@/lib/dates";
import { getSchedule } from "@/lib/schedule";
import { toSessionStatus, type SessionStatus } from "@/models/availability";

/** Most sessions one availability call may ask for. */
export const MAX_AVAILABILITY_IDS = 20;

async function fetchDetail(activityId: number): Promise<{ body: ActivityDetailBody; at: string }> {
  const body = await getActiveNetClient().getActivityDetail(activityId);
  if (body.detail.activity_id !== activityId) {
    throw new Error(`detail for ${activityId} returned activity ${body.detail.activity_id}`);
  }
  return { body, at: new Date().toISOString() };
}

async function remoteDetail(activityId: number) {
  "use cache: remote"; // shared across Vercel instances
  cacheLife("spots");
  cacheTag("spots", `spots-${activityId}`);
  return fetchDetail(activityId);
}

async function remoteButtonStatus(
  activityId: number,
  sessionStart: LocalDateTime,
): Promise<ButtonStatusBody> {
  "use cache: remote"; // shared across Vercel instances
  cacheLife("schedule");
  cacheTag("enroll", `enroll-${activityId}`);
  return getActiveNetClient().getButtonStatus(activityId, sessionStart);
}

// The exported lookups check this instance's memory first (free) and read the
// remote cache (billed per read) only on a miss. Lifetimes carry over from the inner call.

/** Spots left for one session, cached 60 s. */
export async function getCachedDetail(activityId: number) {
  "use cache";
  cacheTag("spots", `spots-${activityId}`);
  return remoteDetail(activityId);
}

/** Enroll link, opening time and notice for one session, cached 10 min. */
export async function getCachedButtonStatus(
  activityId: number,
  sessionStart: LocalDateTime,
): Promise<ButtonStatusBody> {
  "use cache";
  cacheTag("enroll", `enroll-${activityId}`);
  return remoteButtonStatus(activityId, sessionStart);
}

export interface AvailabilityResult {
  /** By activity id. Turn into an Enroll button with toEnrollState(status, now). */
  statuses: Record<number, SessionStatus>;
  /** Ids that aren't upcoming enroll-online sessions. */
  unknownIds: number[];
  /** Ids whose lookup failed; show "Check on ActiveMississauga". */
  failedIds: number[];
}

export interface AvailabilityOptions {
  /** Skip the 60 s cache for spots left (the refresh button). Rate-limit callers. */
  fresh?: boolean;
}

/** Looks up availability for up to MAX_AVAILABILITY_IDS enroll-online sessions. */
export async function getAvailability(
  activityIds: readonly number[],
  { fresh = false }: AvailabilityOptions = {},
): Promise<AvailabilityResult> {
  const ids = [...new Set(activityIds)];
  if (ids.length > MAX_AVAILABILITY_IDS) {
    throw new RangeError(`At most ${MAX_AVAILABILITY_IDS} sessions per request`);
  }
  if (!ids.every((id) => Number.isInteger(id) && id > 0)) {
    throw new RangeError("Session ids must be positive integers");
  }

  const { sessions } = await getSchedule(["enroll"]);
  const now = toTorontoLocal(new Date());
  const startById = new Map(
    sessions.filter((s) => s.end > now).map((s) => [s.activityId, s.start]),
  );

  const result: AvailabilityResult = { statuses: {}, unknownIds: [], failedIds: [] };
  await Promise.all(
    ids.map(async (id) => {
      const start = startById.get(id);
      if (!start) {
        result.unknownIds.push(id);
        return;
      }
      try {
        const [detail, button] = await Promise.all([
          fresh ? fetchDetail(id) : getCachedDetail(id),
          getCachedButtonStatus(id, start),
        ]);
        // The cached count is now older than what this caller saw, so drop it:
        // the next normal load fetches again instead of showing the old count.
        if (fresh) revalidateTag(`spots-${id}`, { expire: 0 });
        const status = toSessionStatus(id, detail.body, button, new Date(detail.at));
        if (status.spaces.level === "unknown") {
          console.warn(`[availability] unknown space_status for ${id}:`, status.spaces.text);
        }
        result.statuses[id] = status;
      } catch (error) {
        console.error(
          `[availability] lookup failed for ${id}:`,
          error instanceof Error ? error.message : error,
        );
        result.failedIds.push(id);
      }
    }),
  );
  result.unknownIds.sort((a, b) => a - b);
  result.failedIds.sort((a, b) => a - b);
  return result;
}
