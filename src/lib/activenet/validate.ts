/**
 * Runtime checks that a response still has the shape we rely on. The API is
 * unofficial, so a change should fail loudly here instead of rendering
 * nonsense. Used by the client and by the nightly API health check.
 */
import type {
  ActivitiesListBody,
  ActivityDetailBody,
  ActivityFiltersBody,
  ButtonStatusBody,
  Envelope,
  EstimatePriceBody,
  EventsBody,
  FiltersBody,
  MeetingDatesBody,
} from "./types";
import { LOCAL_DATE_TIME } from "./types";

export class ActiveNetShapeError extends Error {
  constructor(
    readonly path: string,
    readonly expected: string,
    readonly actual: unknown,
  ) {
    super(`Unexpected ActiveNet response: ${path} should be ${expected}, got ${describe(actual)}`);
    this.name = "ActiveNetShapeError";
  }
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string") return `"${value.length > 40 ? `${value.slice(0, 40)}…` : value}"`;
  return typeof value;
}

type Check = (value: unknown, path: string) => void;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function fail(path: string, expected: string, actual: unknown): never {
  throw new ActiveNetShapeError(path, expected, actual);
}

const object: Check = (v, p) => {
  if (!isObject(v)) fail(p, "an object", v);
};
const string: Check = (v, p) => {
  if (typeof v !== "string") fail(p, "a string", v);
};
const nullableString: Check = (v, p) => {
  if (v !== null && typeof v !== "string") fail(p, "a string or null", v);
};
const integer: Check = (v, p) => {
  if (!Number.isInteger(v)) fail(p, "an integer", v);
};
const localDateTime: Check = (v, p) => {
  if (typeof v !== "string" || !LOCAL_DATE_TIME.test(v)) fail(p, '"YYYY-MM-DD HH:mm:ss"', v);
};
const optionalLocalDateTime: Check = (v, p) => {
  if (v !== "") localDateTime(v, p);
};

function fields(value: unknown, path: string, checks: Record<string, Check>): void {
  object(value, path);
  const obj = value as Record<string, unknown>;
  for (const [key, check] of Object.entries(checks)) check(obj[key], `${path}.${key}`);
}

function arrayOf(check: Check): Check {
  return (v, p) => {
    if (!Array.isArray(v)) fail(p, "an array", v);
    v.forEach((item, i) => check(item, `${p}[${i}]`));
  };
}

function shape(checks: Record<string, Check>): Check {
  return (v, p) => fields(v, p, checks);
}

/** Checks the `{ headers, body }` envelope and that `response_code` is "0000". */
export function assertEnvelope(value: unknown): asserts value is Envelope<unknown> {
  fields(value, "response", {
    headers: shape({ response_code: string, response_message: string }),
    body: object,
  });
}

export function assertFiltersBody(body: unknown): asserts body is FiltersBody {
  fields(body, "body", {
    center: arrayOf(shape({ id: integer, name: string })),
  });
}

const facility = shape({
  facility_id: integer,
  facility_name: string,
  center_id: integer,
  center_name: string,
});

const event = shape({
  title: string,
  start_time: localDateTime,
  end_time: localDateTime,
  event_item_id: integer,
  activity_detail_url: nullableString,
  facilities: arrayOf(facility),
});

export function assertEventsBody(body: unknown): asserts body is EventsBody {
  fields(body, "body", {
    center_events: arrayOf(
      shape({ center_id: integer, center_name: string, total: integer, events: arrayOf(event) }),
    ),
  });
}

export function assertActivityDetailBody(body: unknown): asserts body is ActivityDetailBody {
  fields(body, "body", {
    detail: shape({ activity_id: integer, activity_name: string, space_status: nullableString }),
  });
}

const actionLink: Check = (v, p) => {
  if (v !== null) fields(v, p, { href: string });
};

export function assertButtonStatusBody(body: unknown): asserts body is ButtonStatusBody {
  fields(body, "body", {
    button_status: shape({
      activity_online_start_time: optionalLocalDateTime,
      action_link: actionLink,
      notification: string,
    }),
  });
}

const program = shape({
  id: integer,
  name: string,
  location: shape({ label: string }),
  days_of_week: string,
  time_range: string,
  date_range_start: string,
  date_range_end: string,
  ages: string,
  total_open: integer,
  activity_online_start_time: optionalLocalDateTime,
});

export function assertActivitiesListBody(body: unknown): asserts body is ActivitiesListBody {
  fields(body, "body", { activity_items: arrayOf(program) });
}

const option = shape({ id: string, desc: string });

export function assertActivityFiltersBody(body: unknown): asserts body is ActivityFiltersBody {
  fields(body, "body", {
    centers: arrayOf(option),
    categories: arrayOf(option),
    types: arrayOf(option),
  });
}

export function assertEstimatePriceBody(body: unknown): asserts body is EstimatePriceBody {
  fields(body, "body", { estimateprice: object });
}

export function assertMeetingDatesBody(body: unknown): asserts body is MeetingDatesBody {
  fields(body, "body", { meeting_and_registration_dates: object });
}
