/**
 * Raw shapes of the ActiveNet JSON API, typed only for fields we have seen in
 * real responses (see docs/data-source.md and tests/fixtures/). Every object
 * carries more fields than listed; they are left open on purpose.
 */

/** "YYYY-MM-DD HH:mm:ss" in Toronto local time, with no time zone. */
export type LocalDateTime = string;
export const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** The calendars this app reads: 1 = drop-in, 3 = enroll online. */
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
  // Read only for the details popup (src/models/activity.ts); all optional.
  category?: string | null;
  season_name?: string | null;
  /** A program's payment plan, free text: "Fall 50% now+50% Oct 5". */
  term_name?: string | null;
  /** e.g. "16 yrs +," */
  age_description?: string | null;
  /** "Mixed", "Male" or "Female" */
  allowed_gender?: string | null;
  catalog_description?: string | null;
  /** Can be HTML. Never render as markup. */
  online_notes?: string | null;
  user_notes?: string | null;
  centers?: RawDetailCentre[] | null;
  other_info?: { sessions?: number | null } | null;
  [field: string]: unknown;
}

export interface RawDetailCentre {
  name?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
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
  /** When online enrollment opens (LocalDateTime), or "". */
  activity_online_start_time: string;
  /** Present when the activity can be (or will be) enrolled in online. */
  action_link: RawActionLink | null;
  /** Seconds until enrollment opens; goes stale once cached, so unused. */
  time_remaining?: number;
  /** Plain text or HTML, e.g. "This activity is full…". Never render as markup. */
  notification: string;
  [field: string]: unknown;
}

export interface ButtonStatusBody {
  button_status: RawButtonStatus;
  [field: string]: unknown;
}

// POST /activities/list (the "Activity search": registered programs) -------

/** Filters for /activities/list. Empty fields mean "any". */
export interface ActivitySearchPattern {
  activity_keyword: string;
  center_ids: string[];
  activity_category_ids: string[];
  /** Activity types; the app always sends the non-drop-in ones. */
  activity_type_ids: string[];
  /** 7 characters, Sunday first: "0000010" is Friday. Null for any day. */
  days_of_week: string | null;
  /** A participant's age: both set to it finds programs that suit it. */
  min_age: number | null;
  max_age: number | null;
  /** 1: only programs with openings. */
  open_spots: 1 | null;
  /** e.g. ["17"] for "2027 Winter". */
  season_ids: string[];
}

export interface RawLink {
  href: string;
  label?: string;
  [field: string]: unknown;
}

export interface RawProgram {
  id: number;
  name: string;
  /** HTML. Never render as markup. */
  desc?: string | null;
  location: { label: string; [field: string]: unknown };
  /** "Mon,Wed" or "" */
  days_of_week: string;
  /** "6:30 PM - 7:30 PM" or "" */
  time_range: string;
  /** "2026-10-07" */
  date_range_start: string;
  date_range_end: string;
  /** "At least 9 but less than 13", "3 and up" */
  ages: string;
  total_open: number;
  /** When online registration opens (LocalDateTime), or "". */
  activity_online_start_time: string;
  /** Always present for enrollable programs; Enroll goes here. */
  enroll_now: RawLink | null;
  /** "Full", "In progress" or "". */
  urgent_message?: { status_description?: string | null } | null;
  detail_url?: string | null;
  [field: string]: unknown;
}

export interface ActivitiesListBody {
  activity_items: RawProgram[];
  [field: string]: unknown;
}

export interface ActivitiesPage {
  items: RawProgram[];
  /** All matches, from the response's page_info. */
  total: number;
}

// GET /activities/filters -------------------------------------------------

export interface RawOption {
  id: string;
  desc: string;
  [field: string]: unknown;
}

export interface ActivityFiltersBody {
  centers: RawOption[];
  categories: RawOption[];
  types: RawOption[];
  seasons?: RawOption[];
  [field: string]: unknown;
}

// GET /activity/detail/estimateprice/{id} ---------------------------------

export interface EstimatePriceBody {
  estimateprice: {
    free?: boolean;
    prices?: Array<{ details?: Array<{ price?: string; description?: string }> | null }> | null;
    [field: string]: unknown;
  };
  [field: string]: unknown;
}

// GET /activity/detail/meetingandregistrationdates/{id} -------------------

export interface MeetingDatesBody {
  meeting_and_registration_dates: {
    activity_patterns?: Array<{
      beginning_date?: string;
      ending_date?: string;
      /** e.g. [{ weekdays: "Weekdays" | "Sat" | "Mon, Wed", starting_time: "09:00:00", ending_time: "12:00:00" }] */
      pattern_dates?: Array<{ weekdays?: string; starting_time?: string; ending_time?: string }>;
    }> | null;
    [field: string]: unknown;
  };
  [field: string]: unknown;
}
