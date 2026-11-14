import type { ActivityDetailBody, ButtonStatusBody, LocalDateTime } from "@/lib/activenet/types";
import { noticeToText, safeCityUrl } from "./links";

/** Openings at or below this count are shown as "few". */
export const FEW_SPACES = 5;

export type Spaces =
  | { level: "full"; count: 0 }
  | { level: "few" | "open"; count: number }
  | { level: "unknown"; text: string | null };

/** Parses the City's `space_status`: "Full" or "N openings remaining". */
export function parseSpaces(spaceStatus: string | null | undefined): Spaces {
  const text = spaceStatus?.trim() ?? null;
  if (text && /^full$/i.test(text)) return { level: "full", count: 0 };
  const match = text?.match(/^(\d+) openings? remaining$/i);
  if (match) {
    const count = Number(match[1]);
    if (count === 0) return { level: "full", count: 0 };
    return { level: count <= FEW_SPACES ? "few" : "open", count };
  }
  return { level: "unknown", text };
}

/**
 * What we know about one session's availability, as fetched. Plain data so it
 * can be cached; turn it into an EnrolState with `toEnrolState` at the time
 * it's shown, because "opens at 7 am" depends on the current time.
 */
export interface SessionStatus {
  activityId: number;
  spaces: Spaces;
  /** Safe enrol URL, present once online enrolment is (or will be) possible. */
  enrolUrl: string | null;
  /** When online enrolment opens, or null if already open or not applicable. */
  opensAt: LocalDateTime | null;
  /** The City's notice as plain text, e.g. "This activity is full…". */
  notice: string;
  /** When this was fetched from the City, as an ISO timestamp. */
  checkedAt: string;
}

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** Combines the detail and button-status responses for one session. */
export function toSessionStatus(
  activityId: number,
  detail: ActivityDetailBody | null,
  button: ButtonStatusBody | null,
  checkedAt: Date,
): SessionStatus {
  const status = button?.button_status;
  const opens = status?.activity_online_start_time ?? "";
  return {
    activityId,
    spaces: detail ? parseSpaces(detail.detail.space_status) : { level: "unknown", text: null },
    enrolUrl: safeCityUrl(status?.action_link?.href),
    opensAt: LOCAL_DATE_TIME.test(opens) ? opens : null,
    notice: noticeToText(status?.notification),
    checkedAt: checkedAt.toISOString(),
  };
}

export type EnrolState =
  | { state: "enrol"; url: string }
  | { state: "opens"; opensAt: LocalDateTime; url: string }
  | { state: "full" }
  | { state: "closed"; message: string }
  | { state: "unknown" };

/**
 * Decides what the Enrol button shows. `now` is Toronto local time in the
 * API's format (see toTorontoLocal). Order matters: "full" wins over a link.
 */
export function toEnrolState(status: SessionStatus | null, now: LocalDateTime): EnrolState {
  if (!status) return { state: "unknown" };
  if (status.spaces.level === "full" || /\bfull\b/i.test(status.notice)) return { state: "full" };
  if (status.enrolUrl) {
    if (status.opensAt && status.opensAt > now) {
      return { state: "opens", opensAt: status.opensAt, url: status.enrolUrl };
    }
    return { state: "enrol", url: status.enrolUrl };
  }
  // Any other notice is passed on in the City's own words, e.g. "We're sorry,
  // but this activity is over…" once a session has started.
  if (status.notice) return { state: "closed", message: status.notice };
  return { state: "unknown" };
}
