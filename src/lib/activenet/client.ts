/**
 * Raw client for the City's ActiveNet JSON API. It knows URLs, request bodies
 * and response shapes, and nothing about sessions, enrollment or caching. Every
 * request goes through a shared throttle. Server-side only.
 */
import { createThrottle, type Throttle } from "./throttle";
import { LOCAL_DATE_TIME } from "./types";
import type {
  ActivitiesPage,
  ActivityDetailBody,
  ActivityFiltersBody,
  ActivitySearchPattern,
  ButtonStatusBody,
  CalendarId,
  Envelope,
  EstimatePriceBody,
  EventsBody,
  EventsQuery,
  FiltersBody,
  LocalDateTime,
  MeetingDatesBody,
} from "./types";
import {
  assertActivitiesListBody,
  assertActivityDetailBody,
  assertActivityFiltersBody,
  assertButtonStatusBody,
  assertEnvelope,
  assertEstimatePriceBody,
  assertEventsBody,
  assertFiltersBody,
  assertMeetingDatesBody,
} from "./validate";

export const DEFAULT_BASE_URL = "https://anc.ca.apm.activecommunities.com/activemississauga/rest";

const LOCALE = "en-US";

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
  /** One page (PROGRAMS_PER_PAGE rows, by start date) of the City's activity search. */
  searchActivities(pattern: ActivitySearchPattern, page: number): Promise<ActivitiesPage>;
  /** The activity search's centres, categories and types. */
  getActivityFilters(): Promise<ActivityFiltersBody>;
  /** Fees (Resident / Non-resident) for one program. */
  getEstimatePrice(activityId: number): Promise<EstimatePriceBody>;
  /** When one program meets: dates, weekdays and times. */
  getMeetingDates(activityId: number): Promise<MeetingDatesBody>;
}

/** Rows per page of /activities/list; the City caps it at 20. */
export const PROGRAMS_PER_PAGE = 20;

/** One throttle for the whole process, so separate clients share the limit. */
const sharedThrottle = createThrottle();

export function createActiveNetClient(options: ActiveNetClientOptions = {}): ActiveNetClient {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const fetchImpl = options.fetch ?? fetch;
  const throttle = options.throttle ?? sharedThrottle;
  const timeoutMs = options.timeoutMs ?? 20_000;

  async function request<Body>(
    path: string,
    init: { method: "GET" | "POST"; body?: unknown; headers?: Record<string, string> },
    assertBody: (body: unknown) => asserts body is Body,
  ): Promise<Body> {
    return (await requestEnvelope(path, init, assertBody)).body;
  }

  async function requestEnvelope<Body>(
    path: string,
    init: { method: "GET" | "POST"; body?: unknown; headers?: Record<string, string> },
    assertBody: (body: unknown) => asserts body is Body,
  ): Promise<Envelope<Body>> {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = { Accept: "application/json", ...init.headers };
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
    return json as Envelope<Body>;
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

    async searchActivities(pattern, page) {
      if (!Number.isInteger(page) || page < 1) throw new RangeError("page must be 1 or more");
      const envelope = await requestEnvelope(
        `/activities/list?locale=${LOCALE}`,
        {
          method: "POST",
          // Paging goes in a header; the City ignores page sizes over 20.
          headers: {
            page_info: JSON.stringify({
              order_by: "Date range",
              page_number: page,
              total_records_per_page: PROGRAMS_PER_PAGE,
            }),
          },
          body: {
            activity_search_pattern: { activity_select_param: 2, for_map: false, ...pattern },
            activity_transfer_pattern: {},
          },
        },
        assertActivitiesListBody,
      );
      const total = (envelope.headers.page_info as { total_records?: unknown } | undefined)
        ?.total_records;
      return {
        items: envelope.body.activity_items,
        total: Number.isInteger(total) ? (total as number) : envelope.body.activity_items.length,
      };
    },

    getActivityFilters() {
      return request(
        `/activities/filters?locale=${LOCALE}`,
        { method: "GET" },
        assertActivityFiltersBody,
      );
    },

    getEstimatePrice(activityId) {
      assertId(activityId, "activityId");
      return request(
        `/activity/detail/estimateprice/${activityId}?locale=${LOCALE}`,
        { method: "GET" },
        assertEstimatePriceBody,
      );
    },

    getMeetingDates(activityId) {
      assertId(activityId, "activityId");
      return request(
        `/activity/detail/meetingandregistrationdates/${activityId}?locale=${LOCALE}`,
        { method: "GET" },
        assertMeetingDatesBody,
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

/** A client configured from the environment (ACTIVENET_BASE_URL, ACTIVENET_USER_AGENT), plus any `overrides`. */
export function activeNetClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  overrides: ActiveNetClientOptions = {},
): ActiveNetClient {
  return createActiveNetClient({
    baseUrl: env.ACTIVENET_BASE_URL || undefined,
    userAgent: env.ACTIVENET_USER_AGENT || undefined,
    ...overrides,
  });
}
