# Data source

All data comes from the public JSON endpoints behind the City of Mississauga's
ActiveNet online calendar (ActiveMississauga). They are undocumented and may
change without notice. No login or API key is needed.

Base URL: `https://anc.ca.apm.activecommunities.com/activemississauga/rest`
(override with `ACTIVENET_BASE_URL`).

Everything below was confirmed against live responses on 2026-11-14. The
recorded responses are in `tests/fixtures/`, and
`tests/unit/activenet-fixtures.test.ts` checks the facts listed here against
them. The client is `src/lib/activenet/client.ts`.

## Calendars

| `calendar_id` | Contents                      | Centres | In this app           |
| ------------- | ----------------------------- | ------- | --------------------- |
| 1             | Drop-in programs              | 21      | "Drop-in" badge       |
| 2             | Library programs              | –       | Not used              |
| 3             | Programs you enroll in online | 10      | "Enroll online" badge |

On 2026-11-14, calendar 3 held only **"Drop In Adult Pickleball"**, with about
480 sessions across its 10 centres. Centre ids are shared across calendars.
`data/centres.dropin.json` and `data/centres.enroll.json` hold the current
lists; `npm run update-centres` refreshes them, and a weekly workflow does the
same.

## Every response

Every response is wrapped as `{ "headers": { "response_code": "0000",
"response_message": "Successful", … }, "body": { … } }`. The client treats any
`response_code` other than `"0000"` as an error.

## Endpoints

### Centres: `POST /onlinecalendar/filters?locale=en-US`

The body is `{"calendar_id": "1"}`, with the id as a **string**. The client
uses `body.center[]`, where each entry is `{ id, name }`. The body also holds
`calendar_period` (for example `2026-11-09` to `2027-02-22`) and the activity,
category and facility lists, which we don't use.

### Sessions: `POST /onlinecalendar/multicenter/events`

The body has `calendar_id` as a **number**, plus `center_ids[]` and empty
filter fields (see `getEvents` in the client). The response is
`body.center_events[]`, one entry per centre, each `{ center_id, center_name,
total, events[] }`. Each event has these fields:

| Field                 | Notes                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`               | e.g. "Drop In Adult Pickleball"                                                                                                                |
| `start_time`          | `YYYY-MM-DD HH:mm:ss`, Toronto local time, no zone                                                                                             |
| `end_time`            | same format                                                                                                                                    |
| `event_item_id`       | The **activity id** for `/activity/detail`. In calendar 1 one activity has many sessions; in calendar 3 **every session is its own activity**. |
| `activity_detail_url` | The City's page for the activity                                                                                                               |
| `facilities[]`        | `{ facility_id, facility_name, center_id, center_name }`, sometimes several (e.g. Gym A, Gym B)                                                |
| `description`         | Plain text                                                                                                                                     |

`action_link` is always `null` here. Enrollment links come from `buttonstatus`.

**The answers to the Phase 1 open questions:**

- **Date range:** `search_start_time` and `search_end_time` are **ignored**.
  `"2026-12-21"`, `"2026-12-21 00:00:00"`, `"12/21/2026"` and ISO
  `"2026-12-21T00:00:00"` all return the same results as empty strings. The API
  always returns its whole window, from the Monday of the current week
  (including past sessions) up to about 6 to 8 weeks ahead. The app filters by
  date itself.
- **Centres per request:** all of them. Sending every centre works in one
  request, and there is no paging (`total` always equals `events.length`, with
  no cap seen). Responses are big: calendar 1 with all 21 centres is about
  **12 MB** (8,845 sessions), and one busy centre is about 1.2 MB. Calendar 3
  with all 10 centres is about 0.7 MB.
- **Calendar 3 shape:** the same as calendar 1.
- **Spots for one session:** for calendar 3, `GET /activity/detail/{event_item_id}`
  is already per session, because each session has its own id (`first_date` =
  `last_date`). Neither `detail` nor `buttonstatus` needs a session date to pick
  it. Counts are therefore cached by `event_item_id`. For calendar 1, the
  detail covers the whole run of the activity (e.g. 27 sessions from September
  to January, "29 openings remaining"), so it is **not** a per-session count,
  and the app doesn't show it.

### Spots left: `GET /activity/detail/{id}?locale=en-US`

The client uses `body.detail`:

- `space_status`: `"Full"` or `"N openings remaining"`. No other wording has
  been seen; the nightly health check fails if it changes.
- `space_type`: `2` when there are openings and `3` when full. It isn't relied
  on, but it agrees with `space_status`.
- `first_date` and `last_date`: the same day for a calendar 3 session.

### Enroll status: `GET /activity/detail/buttonstatus/{id}?selected_date=YYYY-MM-DD HH:mm:ss&locale=en-US`

The client uses `body.button_status`. Four states have been seen:

| State                | `action_link`                                                                   | `activity_online_start_time`                                      | `notification`                                                                                  |
| -------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Enrollment open now  | `{ href: ".../activity/search/enroll/{id}?locale=en-US", label: "Enroll Now" }` | `""` (empty, **not** a past time)                                 | `""`                                                                                            |
| Opens later          | the same link, already present                                                  | e.g. `"2026-12-30 07:00:00"`: **7 am the day before** the session | `""`                                                                                            |
| Full                 | `null`                                                                          | `""`                                                              | `<div>This activity is full and is not able to accept any more enrollments.</div>…`             |
| Over                 | `null`                                                                          | `""`                                                              | `We're sorry, but this activity is over. The last meeting was …`                                |
| Calendar 1 (drop-in) | `null`                                                                          | `""`                                                              | `Online registration is not available for this activity. Admittance … first come-first served.` |

`time_remaining` is seconds until opening. It goes stale as soon as it's
cached, so the app ignores it. `notification` can be HTML, so the app turns it
into plain text and never renders it as markup.

## Being a polite client

- Every request to the City is made by our server, never the browser.
- Request starts are throttled to at most 2 per second, with at most 4 in
  flight (`src/lib/activenet/throttle.ts`). The throttle is per server process.
- Results are cached: schedules for 10 minutes and spot counts for 60 seconds.
  Because the raw calendar 1 response is about 12 MB, the cache holds the
  normalised sessions, not raw responses.
- Tests use recorded fixtures only and never call the live API.
  `npm run capture-fixtures` re-records them with about 15 requests.
- Set `ACTIVENET_USER_AGENT` to give the City a way to identify and contact the
  deployment.
- Every result links back to the City's site, where registration happens.
