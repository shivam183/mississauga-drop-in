import type { CalendarId, EventsBody, LocalDateTime, RawFacility } from "@/lib/activenet/types";
import { safeCityUrl } from "./links";

/** "dropin" comes from calendar 1, "enroll" from calendar 3. */
export type SessionType = "dropin" | "enroll";

export const CALENDAR_FOR_TYPE: Record<SessionType, CalendarId> = { dropin: 1, enroll: 3 };
export const TYPE_FOR_CALENDAR: Record<CalendarId, SessionType> = { 1: "dropin", 3: "enroll" };

/** One scheduled occurrence of a program. Plain data, so it can be cached and serialized. */
export interface Session {
  /** Stable and unique, e.g. "e164373-202612310830". */
  id: string;
  type: SessionType;
  title: string;
  centreId: number;
  centreName: string;
  /** The room(s) without the centre prefix, e.g. "Gym A, Gym B". Empty if unknown. */
  facility: string;
  start: LocalDateTime;
  end: LocalDateTime;
  /** ActiveNet activity id. For "enroll" sessions it identifies this one session. */
  activityId: number;
  /** The City's page for the activity (https *.activecommunities.com only). */
  url: string | null;
}

/**
 * Words the City uses to end a shortened centre name before the room, e.g.
 * "Huron Park RC", "Miss Seniors' Cntr", "Port Credit Mem Arena". The first
 * one wins, so "Miss Valley CC Arena" keeps "Arena" as the room.
 */
const CENTRE_SUFFIX = /^.*?\b(CC|RC|SP|Cntr|Arena|Rinks|Gymnasium|SportsPlex)\s+/i;

/** "Mississauga Sports and Ent. Centre SportsPlex" -> "msecs", so "MSEC" counts as its short name. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w && !/^(and|of|the|&)$/i.test(w))
    .map((w) => w[0].toLowerCase())
    .join("");
}

/**
 * "Churchill Mdws CC Gym 2,3 (Full Court)" at "Churchill Meadows Community
 * Centre" becomes "Gym 2,3 (Full Court)".
 */
export function roomName(facilityName: string, centreName: string): string {
  const name = facilityName.trim();
  if (name.toLowerCase().startsWith(`${centreName.toLowerCase()} `)) {
    return name.slice(centreName.length + 1).trim();
  }
  const match = name.match(CENTRE_SUFFIX);
  // Only strip if the prefix starts like the centre name does ("Miss" for "Mississauga").
  const first = name.split(" ")[0].toLowerCase();
  const looksLikeCentre =
    centreName.toLowerCase().startsWith(first) ||
    (first.length >= 3 && initials(centreName).startsWith(first));
  if (match && first && looksLikeCentre) {
    const rest = name.slice(match[0].length).trim();
    if (rest) return rest;
  }
  return name;
}

function facilityLabel(facilities: RawFacility[], centreName: string): string {
  const rooms = facilities.map((f) => roomName(f.facility_name, centreName)).filter(Boolean);
  return [...new Set(rooms)].join(", ");
}

export function sessionId(type: SessionType, activityId: number, start: LocalDateTime): string {
  return `${type === "dropin" ? "d" : "e"}${activityId}-${start.replace(/\D/g, "").slice(0, 12)}`;
}

/** Turns one events response into sessions, de-duplicated and sorted. */
export function normalizeEvents(body: EventsBody, calendar: CalendarId): Session[] {
  const type = TYPE_FOR_CALENDAR[calendar];
  const byId = new Map<string, Session>();
  for (const centre of body.center_events) {
    for (const event of centre.events) {
      const id = sessionId(type, event.event_item_id, event.start_time);
      if (byId.has(id)) continue;
      byId.set(id, {
        id,
        type,
        title: event.title.trim(),
        centreId: centre.center_id,
        centreName: centre.center_name.trim(),
        facility: facilityLabel(event.facilities, centre.center_name.trim()),
        start: event.start_time,
        end: event.end_time,
        activityId: event.event_item_id,
        url: safeCityUrl(event.activity_detail_url),
      });
    }
  }
  return sortSessions([...byId.values()]);
}

/** By start time, then centre, then title. Returns a new array. */
export function sortSessions(sessions: readonly Session[]): Session[] {
  return [...sessions].sort(
    (a, b) =>
      // Fixed-width "YYYY-MM-DD HH:mm:ss", so a plain comparison sorts by time (and is much cheaper).
      (a.start < b.start ? -1 : a.start > b.start ? 1 : 0) ||
      a.centreName.localeCompare(b.centreName) ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id),
  );
}

/** Merges session lists (e.g. both calendars) into one sorted list without duplicates. */
export function mergeSessions(...lists: ReadonlyArray<readonly Session[]>): Session[] {
  const byId = new Map<string, Session>();
  for (const list of lists) for (const s of list) if (!byId.has(s.id)) byId.set(s.id, s);
  return sortSessions([...byId.values()]);
}
