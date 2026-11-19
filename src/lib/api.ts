/**
 * Shared pieces of the public JSON API (/api/centres, /api/sessions,
 * /api/availability, /api/programs). The response shapes here are a public contract:
 * documented in docs/api.md, and kept stable when internals change.
 */
import { LOCAL_DATE_TIME, type LocalDateTime } from "@/lib/activenet/types";
import { TORONTO_TIME_ZONE } from "@/lib/dates";
import type { Program } from "@/models/registered";
import type { Session, SessionType } from "@/models/session";

export const API_DEFAULT_LIMIT = 50;
export const API_MAX_LIMIT = 200;

/** Anyone may call the API from a browser (plain GETs need no preflight). */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
} as const;

export function apiError(status: number, message: string, headers: Record<string, string> = {}) {
  return Response.json(
    { error: message },
    { status, headers: { ...CORS_HEADERS, "Cache-Control": "no-store", ...headers } },
  );
}

export type Page = { limit: number; offset: number } | { error: string };

/** `limit` (1–200, default 50) and `offset` (0+, default 0). */
export function parsePage(params: URLSearchParams): Page {
  const rawLimit = params.get("limit");
  const rawOffset = params.get("offset");
  const limit = rawLimit === null ? API_DEFAULT_LIMIT : Number(rawLimit);
  const offset = rawOffset === null ? 0 : Number(rawOffset);
  if (!Number.isInteger(limit) || limit < 1 || limit > API_MAX_LIMIT) {
    return { error: `limit must be a whole number from 1 to ${API_MAX_LIMIT}` };
  }
  if (!Number.isInteger(offset) || offset < 0) {
    return { error: "offset must be a whole number, 0 or more" };
  }
  return { limit, offset };
}

// --- Times -----------------------------------------------------------------

const torontoParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TORONTO_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Toronto's offset from UTC, in minutes, at an instant. */
function torontoOffsetMinutes(utcMs: number): number {
  const p = Object.fromEntries(torontoParts.formatToParts(utcMs).map((x) => [x.type, x.value]));
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((wall - utcMs) / 60_000);
}

/**
 * "2026-11-15 07:30:00" (Toronto wall time) -> "2026-11-15T07:30:00-05:00".
 * Correct across daylight saving changes.
 */
export function torontoIso(local: LocalDateTime): string {
  const [date, time] = local.split(" ");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm, ss] = time.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm, ss);
  // The offset at the wall time itself, refined once for times near a change.
  let offset = torontoOffsetMinutes(asUtc);
  offset = torontoOffsetMinutes(asUtc - offset * 60_000);
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  const zone = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  return `${date}T${time}${zone}`;
}

// --- Sessions --------------------------------------------------------------

/** One session in the public API. See docs/api.md. */
export interface ApiSession {
  id: string;
  type: SessionType;
  title: string;
  centre: { id: number; name: string };
  /** Room(s) within the centre, e.g. "Gym A, Gym B"; "" if unknown. */
  facility: string;
  /** ISO 8601 with Toronto's UTC offset. */
  start: string;
  end: string;
  /** ActiveNet activity id; for "enroll" sessions, use it with /api/availability. */
  activityId: number;
  /** The City's page for the activity, or null. */
  url: string | null;
}

export function toApiSession(session: Session): ApiSession {
  return {
    id: session.id,
    type: session.type,
    title: session.title,
    centre: { id: session.centreId, name: session.centreName },
    facility: session.facility,
    start: torontoIso(session.start),
    end: torontoIso(session.end),
    activityId: session.activityId,
    url: session.url,
  };
}

// --- Registered programs ---------------------------------------------------

/** One registered program in the public API. See docs/api.md. */
export interface ApiProgram {
  id: number;
  name: string;
  /** Where it runs: a centre, library, pool or park. */
  location: string;
  /** As the site shows them: "Mon, Wed", "6:30 – 7:30 PM", "Jan 4 – Mar 8"; "" if unknown. */
  days: string;
  time: string;
  dates: string;
  /** The City's wording, e.g. "At least 9 but less than 13"; "" if unknown. */
  ages: string;
  /** Online registration: open now, full, or opening at `opensAt` (ISO 8601). */
  status:
    | { state: "open"; spots: number }
    | { state: "full" }
    | { state: "opens"; opensAt: string | null; spots: number };
  /** Already under way; you can often still join. */
  started: boolean;
  /** The City's enroll page and program page, or null. */
  enrollUrl: string | null;
  url: string | null;
}

export function toApiProgram(program: Program): ApiProgram {
  const { status } = program;
  return {
    id: program.id,
    name: program.name,
    location: program.centre,
    days: program.days,
    time: program.time,
    dates: program.dates,
    ages: program.ages,
    status:
      status.state === "full"
        ? { state: "full" }
        : status.state === "open"
          ? { state: "open", spots: status.spots }
          : {
              state: "opens",
              opensAt: LOCAL_DATE_TIME.test(status.at) ? torontoIso(status.at) : null,
              spots: status.spots,
            },
    started: program.started,
    enrollUrl: program.enrollUrl,
    url: program.cityUrl,
  };
}
