/**
 * Raw shapes of the ActiveNet JSON API, typed only for fields we have seen in
 * real responses (see docs/data-source.md and tests/fixtures/). Every object
 * carries more fields than listed; they are left open on purpose.
 */

/** "YYYY-MM-DD HH:mm:ss" in Toronto local time, with no time zone. */
export type LocalDateTime = string;

/** The calendars this app reads: 1 = drop-in, 3 = enrol online. */
export type CalendarId = 1 | 3;

export interface Envelope<Body> {
  headers: {
    /** "0000" means success. */
    response_code: string;
    response_message: string;
    [field: string]: unknown;
  };
  body: Body;
}

// POST /onlinecalendar/filters --------------------------------------------

export interface RawCentre {
  id: number;
  name: string;
  [field: string]: unknown;
}

export interface FiltersBody {
  center: RawCentre[];
  /** For example { start_date: "2026-11-09", end_date: "2027-02-22" }. */
  calendar_period?: { start_date: string; end_date: string };
  [field: string]: unknown;
}

// POST /onlinecalendar/multicenter/events --------------------------------

export interface RawFacility {
  facility_id: number;
  facility_name: string;
  center_id: number;
  center_name: string;
  [field: string]: unknown;
}

export interface RawEvent {
  title: string;
  start_time: LocalDateTime;
  end_time: LocalDateTime;
  /**
   * The activity id used by /activity/detail. In calendar 1 one activity has
   * many sessions. In calendar 3 every session is its own activity.
   */
  event_item_id: number;
  activity_detail_url: string | null;
  facilities: RawFacility[];
  description?: string;
  [field: string]: unknown;
}

export interface RawCentreEvents {
  center_id: number;
  center_name: string;
  total: number;
  events: RawEvent[];
  [field: string]: unknown;
}

export interface EventsBody {
  center_events: RawCentreEvents[];
  [field: string]: unknown;
}

export interface EventsQuery {
  calendar_id: CalendarId;
  center_ids: number[];
  display_all: 0 | 1;
  /** Sent empty: the API ignores it in every format tried (see docs/data-source.md). */
  search_start_time: string;
  search_end_time: string;
  facility_ids: number[];
  activity_category_ids: number[];
  activity_sub_category_ids: number[];
  activity_ids: number[];
  activity_min_age: number | null;
  activity_max_age: number | null;
  event_type_ids: number[];
}

// GET /activity/detail/{id} -----------------------------------------------

export interface RawActivityDetail {
  activity_id: number;
  activity_name: string;
  activity_type?: string;
  /** "Full" or "N openings remaining". */
  space_status: string | null;
  /** Seen: 2 with openings, 3 when full. */
  space_type?: number;
  first_date?: string;
  last_date?: string;
  [field: string]: unknown;
}

export interface ActivityDetailBody {
  detail: RawActivityDetail;
  [field: string]: unknown;
}

// GET /activity/detail/buttonstatus/{id} ----------------------------------

export interface RawActionLink {
  href: string;
  label?: string;
  [field: string]: unknown;
}

export interface RawButtonStatus {
  /** When online enrolment opens (LocalDateTime), or "". */
  activity_online_start_time: string;
  /** Present when the activity can be (or will be) enrolled in online. */
  action_link: RawActionLink | null;
  /** Seconds until enrolment opens; goes stale once cached, so unused. */
  time_remaining?: number;
  /** Plain text or HTML, e.g. "This activity is full…". Never render as markup. */
  notification: string;
  [field: string]: unknown;
}

export interface ButtonStatusBody {
  button_status: RawButtonStatus;
  [field: string]: unknown;
}
