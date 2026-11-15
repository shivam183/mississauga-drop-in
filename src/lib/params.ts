/**
 * All filter state lives in the URL. This reads it defensively (anything
 * invalid is ignored) and builds links that change one thing at a time.
 */
import { ALL_CENTRES, centreDistances, type LatLng } from "@/lib/centres";
import { TIME_OF_DAY_HOURS, type SessionFilters, type TimeOfDay } from "@/models/filters";
import type { SessionType } from "@/models/session";

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const PAGE_SIZE = 30;
export const MAX_LIMIT = 500;
export const MAX_QUERY_LENGTH = 100;

export interface SearchState {
  q: string;
  type: SessionType | null;
  centreIds: number[];
  from: string | null;
  to: string | null;
  times: TimeOfDay[];
  /** How many results to show. */
  limit: number;
  /** One session's id (see sessionId), from a shared link: show only it. */
  session: string | null;
  /** "Near me": where the person is, rounded to about 1 km (2 decimals). */
  near: LatLng | null;
}

export const EMPTY_SEARCH: SearchState = {
  q: "",
  type: null,
  centreIds: [],
  from: null,
  to: null,
  times: [],
  limit: PAGE_SIZE,
  session: null,
  near: null,
};

/** "Near me" shows centres within this many km. */
export const NEARBY_KM = 5;

/** "43.59,-79.64" as a place rounded to 2 decimals, or null if it isn't one. */
function parseNear(value: string | undefined): LatLng | null {
  const match = value?.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const [lat, lng] = [Number(match[1]), Number(match[2])];
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: round2(lat), lng: round2(lng) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A place as the `near` param writes it: "43.59,-79.64". */
export const formatNear = (near: LatLng) => `${round2(near.lat)},${round2(near.lng)}`;

/** sessionId's shape: "d" or "e", the activity id, "-", then YYYYMMDDHHmm. */
const SESSION_ID = /^[de]\d{1,12}-\d{12}$/;

const TIMES = Object.keys(TIME_OF_DAY_HOURS) as TimeOfDay[];
const CENTRE_IDS = new Set(ALL_CENTRES.map((c) => c.id));
const CENTRE_BY_NAME = new Map(ALL_CENTRES.map((c) => [c.name.toLowerCase(), c.id]));

/** A centre given by id ("290") or by name, as the filter form's type-ahead sends it. */
function centreId(value: string): number | null {
  const id = Number(value);
  if (CENTRE_IDS.has(id)) return id;
  return CENTRE_BY_NAME.get(value.replace(/\s+/g, " ").trim().toLowerCase()) ?? null;
}

/** Every value of a param, split on commas: ?a=1,2&a=3 -> ["1", "2", "3"]. */
function values(params: RawSearchParams, key: string): string[] {
  const raw = params[key];
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  return list
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
}

function first(params: RawSearchParams, key: string): string | undefined {
  return values(params, key)[0];
}

export function isIsoDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function parseSearchParams(params: RawSearchParams): SearchState {
  const rawQ = Array.isArray(params.q) ? params.q[0] : params.q;
  const q = (rawQ ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
  const type = first(params, "type");
  // The filter form sends `day`: a date, "any", or "keep" (keep the from/to
  // range from the URL). Links and the API can use from/to directly.
  const day = first(params, "day");
  const anyDay = day === "any";
  const from = isIsoDate(day) ? day : anyDay ? undefined : first(params, "from");
  const to = isIsoDate(day) ? day : anyDay ? undefined : first(params, "to");
  const limit = Number(first(params, "limit"));
  const session = first(params, "session");

  const state: SearchState = {
    q,
    type: type === "dropin" || type === "enroll" ? type : null,
    centreIds: [
      ...new Set(
        values(params, "centre")
          .map(centreId)
          .filter((id): id is number => id !== null),
      ),
    ].sort((a, b) => a - b),
    from: isIsoDate(from) ? from : null,
    to: isIsoDate(to) ? to : null,
    times: TIMES.filter((t) => values(params, "time").includes(t)),
    limit:
      Number.isInteger(limit) && limit > PAGE_SIZE
        ? Math.min(Math.ceil(limit / PAGE_SIZE) * PAGE_SIZE, MAX_LIMIT)
        : PAGE_SIZE,
    session: session && SESSION_ID.test(session) ? session : null,
    // Not values(): its comma is part of the value.
    near: parseNear(Array.isArray(params.near) ? params.near[0] : params.near),
  };
  if (state.from && state.to && state.from > state.to)
    [state.from, state.to] = [state.to, state.from];
  return state;
}

export function toFilters(state: SearchState): SessionFilters {
  return {
    q: state.q || undefined,
    type: state.type ?? undefined,
    centreIds: state.centreIds,
    from: state.from ?? undefined,
    to: state.to ?? undefined,
    timesOfDay: state.times,
    sessionId: state.session ?? undefined,
    nearbyCentreIds: state.near
      ? [...centreDistances(state.near)].filter(([, km]) => km <= NEARBY_KM).map(([id]) => id)
      : undefined,
  };
}

/** Query string for a state, leaving out defaults. Starts with "?" unless empty. */
export function toQueryString(state: SearchState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.type) params.set("type", state.type);
  if (state.centreIds.length) params.set("centre", state.centreIds.join(","));
  if (state.from) params.set("from", state.from);
  if (state.to) params.set("to", state.to);
  if (state.times.length) params.set("time", state.times.join(","));
  if (state.limit !== PAGE_SIZE) params.set("limit", String(state.limit));
  if (state.session) params.set("session", state.session);
  if (state.near) params.set("near", formatNear(state.near));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Link to `path` with the state changed by `changes`. The result count resets,
 * and so does a shared session: any change goes back to the full list.
 */
export function hrefWith(path: string, state: SearchState, changes: Partial<SearchState>): string {
  return `${path}${toQueryString({ ...state, limit: PAGE_SIZE, session: null, ...changes })}`;
}

/**
 * How many filter choices are on, beyond search text (for the Filters badge):
 * the type, each centre, the day, and each time of day counts once.
 */
export function activeFilterCount(state: SearchState): number {
  return (
    (state.type ? 1 : 0) +
    state.centreIds.length +
    (state.from || state.to ? 1 : 0) +
    state.times.length
  );
}
