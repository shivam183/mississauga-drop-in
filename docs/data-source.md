# Data source

All data comes from the public JSON endpoints behind the City of Mississauga's
ActiveNet online calendar (ActiveMississauga). They are undocumented and may
change without notice. No login or API key is needed.

Base URL: `https://anc.ca.apm.activecommunities.com/activemississauga/rest`

## Calendars

| `calendar_id` | Contents                     | In this app          |
| ------------- | ---------------------------- | -------------------- |
| 1             | Drop-in programs             | "Drop-in" badge      |
| 2             | Library programs             | Not used             |
| 3             | Programs you enrol in online | "Enrol online" badge |

## Endpoints

| Purpose      | Request                                                                                          | Fields used                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Centres      | `POST /onlinecalendar/filters?locale=en-US`, body `{"calendar_id":"1"}` (string)                 | `body.center[]`                                                                                           |
| Events       | `POST /onlinecalendar/multicenter/events`, body with `calendar_id` (number), `center_ids[]`      | `body.center_events[].events[]`: `title`, `start_time`, `end_time`, `facilities[]`, `activity_detail_url` |
| Spots left   | `GET /activity/detail/{activity_id}?locale=en-US`                                                | `body.detail.space_status`                                                                                |
| Enrol status | `GET /activity/detail/buttonstatus/{activity_id}?selected_date=YYYY-MM-DD HH:mm:ss&locale=en-US` | `action_link.href`, `activity_online_start_time`, `notification`                                          |

Times are `YYYY-MM-DD HH:mm:ss` in Toronto local time, with no time zone.

## Known facts

- `space_status` is **per session**, and is either `Full` or `N openings remaining`.

## Open questions (answered in Phase 1)

- Date format accepted by `search_start_time` / `search_end_time`.
- How many centre ids one events request accepts.
- Whether calendar 3 events have the same shape as calendar 1's.
- Which request returns the spots-left count for one specific session.

## Being a polite client

- Every request to the City is made by our server, never the browser.
- Request starts are throttled (at most 2 per second) and responses are cached
  (schedules for 10 minutes, spot counts for 60 seconds).
- Tests use recorded fixtures only; they never call the live API.
- Every result links back to the City's site, where registration happens.
