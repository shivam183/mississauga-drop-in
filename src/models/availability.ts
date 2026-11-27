import {
  LOCAL_DATE_TIME,
  type ActivityDetailBody,
  type ButtonStatusBody,
  type LocalDateTime,
} from "@/lib/activenet/types";
import { noticeToText, safeCityUrl } from "./links";
import { centrePhone } from "./phones";

/** Openings at or below this count are shown as "few". */
export const FEW_SPACES = 5;

/** "1 spot left", "12 spots left". */
export const spotsLeftText = (count: number) => `${count} ${count === 1 ? "spot" : "spots"} left`;

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
 * People on the waitlist when the City's `space_message` says one is open
 * (0 when it gives no count), else undefined.
 */
export function parseWaitlist(spaceMessage: string | null | undefined): number | undefined {
  if (!spaceMessage || !/waiting list registration is open/i.test(spaceMessage)) return undefined;
  if (/\bone person\b/i.test(spaceMessage)) return 1;
  const count = spaceMessage.match(/(\d+) persons?\b/i);
  return count ? Number(count[1]) : 0;
}

/**
 * What we know about one session's availability, as fetched. Plain data so it
 * can be cached; turn it into an EnrollState with `toEnrollState` at the time
 * it's shown, because "opens at 7 am" depends on the current time.
 */
export interface SessionStatus {
  activityId: number;
  spaces: Spaces;
  /** Safe enroll URL, present once online enrollment is (or will be) possible. */
  enrollUrl: string | null;
  /** When online enrollment opens, or null if already open or not applicable. */
  opensAt: LocalDateTime | null;
  /** The City's notice as plain text, e.g. "This activity is full…". */
  notice: string;
  /** Full with a waitlist open: how many are on it (0 when the City gives no count). */
  waitlist?: number;
  /** The centre's phone as the City writes it; missing if unknown (or cached before it was kept). */
  phone?: string;
  /** When this was fetched from the City, as an ISO timestamp. */
  checkedAt: string;
}

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
    enrollUrl: safeCityUrl(status?.action_link?.href),
    opensAt: LOCAL_DATE_TIME.test(opens) ? opens : null,
    notice: noticeToText(status?.notification),
    waitlist: parseWaitlist(detail?.detail.space_message),
    phone: centrePhone(detail?.detail.centers?.[0]) || undefined,
    checkedAt: checkedAt.toISOString(),
  };
}

export type EnrollState =
  | { state: "enroll"; url: string }
  | { state: "opens"; opensAt: LocalDateTime; url: string }
  | { state: "full" }
  /** Full, but the City takes names for a waitlist at `url`; `waiting` are on it already. */
  | { state: "waitlist"; url: string; waiting: number }
  | { state: "closed"; message: string }
  /** Started with spots left: online enrollment is over, but a walk-in may work. */
  | { state: "walk-in"; phone?: string }
  | { state: "unknown" };

/**
 * Decides what the Enroll button shows. `now` is Toronto local time in the
 * API's format (see toTorontoLocal). Order matters: "full" wins over a link
 * (the link is then the waitlist's, when one is open).
 */
export function toEnrollState(status: SessionStatus | null, now: LocalDateTime): EnrollState {
  if (!status) return { state: "unknown" };
  if (status.spaces.level === "full" || /\bfull\b/i.test(status.notice)) {
    return status.waitlist !== undefined && status.enrollUrl
      ? { state: "waitlist", url: status.enrollUrl, waiting: status.waitlist }
      : { state: "full" };
  }
  if (status.enrollUrl) {
    if (status.opensAt && status.opensAt > now) {
      return { state: "opens", opensAt: status.opensAt, url: status.enrollUrl };
    }
    return { state: "enroll", url: status.enrollUrl };
  }
  // Once a session starts the City says "We're sorry, but this activity is
  // over…". With spots still open that reads as "don't bother", but the desk
  // may still take a walk-in, so say that instead.
  const spotsLeft = "count" in status.spaces && status.spaces.count >= 1;
  if (/activity is over/i.test(status.notice) && spotsLeft) {
    return { state: "walk-in", phone: status.phone };
  }
  // Any other notice is passed on in the City's own words.
  if (status.notice) return { state: "closed", message: status.notice };
  return { state: "unknown" };
}
