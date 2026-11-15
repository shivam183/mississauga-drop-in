/**
 * Raw client for the City's ActiveNet JSON API. It knows URLs, request bodies
 * and response shapes, and nothing about sessions, enrollment or caching. Every
 * request goes through a shared throttle. Server-side only.
 */
import { createThrottle, type Throttle } from "./throttle";
import type {
  ActivityDetailBody,
  ButtonStatusBody,
  CalendarId,
  EventsBody,
  EventsQuery,
  FiltersBody,
  LocalDateTime,
} from "./types";
import {
  assertActivityDetailBody,
  assertButtonStatusBody,
  assertEnvelope,
  assertEventsBody,
  assertFiltersBody,
} from "./validate";

export const DEFAULT_BASE_URL = "https://anc.ca.apm.activecommunities.com/activemississauga/rest";

const LOCALE = "en-US";
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export class ActiveNetError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
    readonly responseCode?: string,
  ) {
    super(message);
    this.name = "ActiveNetError";
  }
}

export interface ActiveNetClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  throttle?: Throttle;
  /** Optional User-Agent, e.g. to give the City a contact URL. */
  userAgent?: string;
  /** Per-request timeout. Default 20 s; the full calendar 1 response is ~12 MB. */
  timeoutMs?: number;
}

export interface ActiveNetClient {
  /** Centres (and other filter lists) for one calendar. */
  getFilters(calendar: CalendarId): Promise<FiltersBody>;
  /**
   * All sessions for the given centres. The API ignores date filters and
   * returns its whole window (about 8 weeks from the start of this week).
   */
  getEvents(calendar: CalendarId, centreIds: readonly number[]): Promise<EventsBody>;
  /** Activity detail, including `space_status`. Per session for calendar 3. */
  getActivityDetail(activityId: number): Promise<ActivityDetailBody>;
  /** Enrollment button state for the session starting at `sessionStart`. */
  getButtonStatus(activityId: number, sessionStart: LocalDateTime): Promise<ButtonStatusBody>;
}

/** One throttle for the whole process, so separate clients share the limit. */
const sharedThrottle = createThrottle();

export function createActiveNetClient(options: ActiveNetClientOptions = {}): ActiveNetClient {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const fetchImpl = options.fetch ?? fetch;
  const throttle = options.throttle ?? sharedThrottle;
  const timeoutMs = options.timeoutMs ?? 20_000;

  async function request<Body>(
    path: string,
    init: { method: "GET" | "POST"; body?: unknown },
    assertBody: (body: unknown) => asserts body is Body,
  ): Promise<Body> {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.userAgent) headers["User-Agent"] = options.userAgent;

    const response = await throttle.run(() =>
      fetchImpl(url, {
        method: init.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      }),
    );
    if (!response.ok) {
      throw new ActiveNetError(
        `ActiveNet request failed: HTTP ${response.status}`,
        url,
        response.status,
      );
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new ActiveNetError("ActiveNet response was not JSON", url, response.status);
    }
    assertEnvelope(json);
    if (json.headers.response_code !== "0000") {
      throw new ActiveNetError(
        `ActiveNet error ${json.headers.response_code}: ${json.headers.response_message}`,
        url,
        response.status,
        json.headers.response_code,
      );
    }
    assertBody(json.body);
    return json.body;
  }

  return {
    getFilters(calendar) {
      assertCalendar(calendar);
      // This endpoint wants calendar_id as a string; events wants a number.
      return request(
        `/onlinecalendar/filters?locale=${LOCALE}`,
        { method: "POST", body: { calendar_id: String(calendar) } },
        assertFiltersBody,
      );
    },

    getEvents(calendar, centreIds) {
      assertCalendar(calendar);
      if (centreIds.length === 0) throw new RangeError("centreIds must not be empty");
      centreIds.forEach((id) => assertId(id, "centre id"));
      const body: EventsQuery = {
        calendar_id: calendar,
        center_ids: [...centreIds],
        display_all: 0,
        search_start_time: "",
        search_end_time: "",
        facility_ids: [],
        activity_category_ids: [],
        activity_sub_category_ids: [],
        activity_ids: [],
        activity_min_age: null,
        activity_max_age: null,
        event_type_ids: [],
      };
      return request(
        "/onlinecalendar/multicenter/events",
        { method: "POST", body },
        assertEventsBody,
      );
    },

    getActivityDetail(activityId) {
      assertId(activityId, "activityId");
      return request(
        `/activity/detail/${activityId}?locale=${LOCALE}`,
        { method: "GET" },
        assertActivityDetailBody,
      );
    },

    getButtonStatus(activityId, sessionStart) {
      assertId(activityId, "activityId");
      if (!LOCAL_DATE_TIME.test(sessionStart)) {
        throw new RangeError('sessionStart must look like "2026-11-14 19:00:00"');
      }
      const query = new URLSearchParams({ selected_date: sessionStart, locale: LOCALE });
      return request(
        `/activity/detail/buttonstatus/${activityId}?${query}`,
        { method: "GET" },
        assertButtonStatusBody,
      );
    },
  };
}

function assertCalendar(calendar: number): asserts calendar is CalendarId {
  if (calendar !== 1 && calendar !== 3) throw new RangeError("calendar must be 1 or 3");
}

function assertId(id: number, name: string): void {
  if (!Number.isInteger(id) || id <= 0) throw new RangeError(`${name} must be a positive integer`);
}

/** A client configured from the environment (ACTIVENET_BASE_URL, ACTIVENET_USER_AGENT). */
export function activeNetClientFromEnv(env: NodeJS.ProcessEnv = process.env): ActiveNetClient {
  return createActiveNetClient({
    baseUrl: env.ACTIVENET_BASE_URL || undefined,
    userAgent: env.ACTIVENET_USER_AGENT || undefined,
  });
}
