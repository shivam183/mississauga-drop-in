# Public JSON API

Mississauga Drop-In serves the schedule it shows as JSON, so others can build
on it. It is read-only, needs no key, and can be called from any website
(`Access-Control-Allow-Origin: *`).

The data comes from the City of Mississauga's ActiveMississauga site. This
project is unofficial; always confirm on ActiveMississauga before you go, and
enroll there.

Base URL: `https://mississaugadropin.com`

**Please be gentle.** Every request that isn't cached reaches the City's
servers. Responses are cached (schedules for 10 minutes, spots for 60
seconds), so polling faster than that only returns the same data.

## Conventions

- **Times** are ISO 8601 with Toronto's UTC offset, e.g.
  `2026-11-15T07:30:00-05:00` (`-04:00` in summer).
- **Errors** return a 4xx/5xx status with `{ "error": "message" }`.
- **Session types:** `dropin` (drop-in programs) and `enroll` (programs you
  enroll in online, with spots left).

## `GET /api/centres`

Every community centre, sorted by name, with the session types it lists.

```json
{
  "centres": [
    { "id": 290, "name": "Burnhamthorpe Community Centre", "types": ["dropin", "enroll"] },
    { "id": 403, "name": "Clarkson Library", "types": ["dropin"] }
  ]
}
```

Cached for a day; the list changes rarely.

## `GET /api/sessions`

Upcoming sessions (those that haven't ended), soonest first.

| Parameter | Example                | Meaning                                                                            |
| --------- | ---------------------- | ---------------------------------------------------------------------------------- |
| `q`       | `pickleball`           | Words that must all appear in the title, centre or room                            |
| `type`    | `enroll`               | `dropin` or `enroll`                                                               |
| `centre`  | `290,119`              | Centre ids (or exact names); repeat or comma-separate for several                  |
| `day`     | `2026-11-16`           | One day (Toronto)                                                                  |
| `from`    | `2026-11-16`           | First day, inclusive (with `to`, a range)                                          |
| `to`      | `2026-11-20`           | Last day, inclusive                                                                |
| `time`    | `morning,evening`      | Start time: `morning` (before 12 PM), `afternoon` (12–5 PM), `evening` (from 5 PM) |
| `session` | `e164373-202611160745` | One session by its `id` (what the site's Share links use)                          |
| `limit`   | `100`                  | Sessions per page, 1–200 (default 50)                                              |
| `offset`  | `100`                  | How many to skip (default 0)                                                       |

Unknown or invalid filter values are ignored; an invalid `limit` or `offset`
returns 400.

```json
{
  "generatedAt": "2026-11-14T21:05:00.000Z",
  "total": 409,
  "offset": 0,
  "limit": 50,
  "next": "/api/sessions?type=enroll&offset=50&limit=50",
  "sessions": [
    {
      "id": "e166860-202611141630",
      "type": "enroll",
      "title": "Drop In Adult Pickleball",
      "centre": { "id": 125, "name": "Malton Community Centre" },
      "facility": "Gym",
      "start": "2026-11-14T16:30:00-05:00",
      "end": "2026-11-14T18:30:00-05:00",
      "activityId": 166860,
      "url": "https://ca.apm.activecommunities.com/activemississauga/Activity_Search/drop-in-adult-pickleball/166860"
    }
  ],
  "failedCentres": []
}
```

- `next` is the path of the next page, or `null` on the last one.
- `failedCentres` lists centres whose schedule couldn't be loaded from the City
  just now; results may be missing their sessions.
- The City publishes about 6–8 weeks ahead.

Shared caches may reuse a response for up to a minute.

## `GET /api/availability`

Spots left and enroll status for up to 20 `enroll` sessions, by `activityId`
(from `/api/sessions`). Only upcoming `enroll` sessions are looked up, unless
`kind=program`: then the ids are registered program `id`s (from `/api/programs`),
and drop-ins and programs that are over come back in `unknownIds`.

| Parameter | Example         | Meaning                                                                |
| --------- | --------------- | ---------------------------------------------------------------------- |
| `ids`     | `166860,164542` | Comma-separated `activityId`s, at most 20                              |
| `fresh`   | `1`             | Skip the 60-second cache. Limited to 10 per minute per IP (429 after). |
| `kind`    | `program`       | The ids are registered programs, not sessions                          |

```json
{
  "now": "2026-11-14 15:00:00",
  "statuses": {
    "166860": {
      "activityId": 166860,
      "spaces": { "level": "open", "count": 8 },
      "enrollUrl": "https://anc.ca.apm.activecommunities.com/activemississauga/activity/search/enroll/166860?locale=en-US",
      "opensAt": null,
      "notice": "",
      "checkedAt": "2026-11-14T20:00:00.000Z"
    }
  },
  "enroll": {
    "166860": {
      "state": "enroll",
      "url": "https://anc.ca.apm.activecommunities.com/…/enroll/166860?locale=en-US"
    }
  },
  "unknownIds": [],
  "failedIds": []
}
```

- `spaces.level`: `open` (more than 5), `few` (1–5), `full`, or `unknown` (with
  the City's wording in `text`).
- `enroll` is what the Enroll button shows, worked out at request time:
  - `{ "state": "enroll", "url" }`: enroll now at `url`
  - `{ "state": "opens", "opensAt", "url" }`: online enrollment opens at
    `opensAt` (ISO 8601)
  - `{ "state": "full" }`
  - `{ "state": "waitlist", "url", "waiting" }`: full, but the City takes names
    for a waitlist at `url`; `waiting` people are on it (0 when it doesn't say).
    `statuses` then has `waitlist` with the same count.
  - `{ "state": "closed", "message" }`: the City's notice, in its own words
  - `{ "state": "unknown" }`: check the session's page on ActiveMississauga
- In `statuses`, `opensAt` and `now` are Toronto wall time
  (`YYYY-MM-DD HH:mm:ss`), as the City sends them; `checkedAt` is when the
  City was asked.
- `unknownIds`: not upcoming `enroll` sessions. `failedIds`: the City didn't
  answer; try again later.

Never cached by shared caches.

## `GET /api/programs`

Registered programs (lessons, camps, leagues: sign up once for the season),
the list on [/registered](https://mississaugadropin.com/registered). They're
searched live on the City's site, sorted by start date, 20 per page.

| Parameter | Example   | Meaning                                                                                   |
| --------- | --------- | ----------------------------------------------------------------------------------------- |
| `q`       | `swim`    | Search words, as on the City's site                                                       |
| `cat`     | `47`      | A category id from `/api/programs/filters`                                                |
| `season`  | `27`      | A season id from `/api/programs/filters`, or `all`. Default: upcoming seasons (see below) |
| `age`     | `6`       | The participant's age, 1–99                                                               |
| `day`     | `tue,thu` | Meets on any of these days: `sun` … `sat`                                                 |
| `centre`  | `287,290` | Location ids from `/api/programs/filters` (not `/api/centres`), up to 20                  |
| `open`    | `1`       | Only programs with spots left                                                             |
| `page`    | `2`       | Page, 1–10 (default 1)                                                                    |

Without `season`, only **upcoming seasons** are searched: those with programs
starting today or later, or started in the last two weeks. Unknown or invalid
filter values are ignored; an invalid `page` returns 400. Like the site, at
most 10 pages (200 programs) are served; narrow the search for more.

```json
{
  "generatedAt": "2026-11-14T21:05:00.000Z",
  "total": 1520,
  "page": 1,
  "perPage": 20,
  "next": "/api/programs?q=swim&page=2",
  "programs": [
    {
      "id": 158821,
      "name": "H3O Swim For Life 1",
      "location": "Frank McKechnie Cmty Centre",
      "days": "Sat",
      "time": "8:30 – 9:00 AM",
      "dates": "Sep 26 – Dec 12",
      "ages": "At least 4y 9m but less than 15",
      "status": { "state": "open", "spots": 12 },
      "started": false,
      "enrollUrl": "https://anc.ca.apm.activecommunities.com/activemississauga/activity/search/enroll/158821?wishlist_id=0&locale=en-US",
      "url": "https://ca.apm.activecommunities.com/activemississauga/Activity_Search/h3o-swim-for-life-1/158821?locale=en-US"
    }
  ]
}
```

- `status`: `{ "state": "open", "spots" }`, `{ "state": "full" }`, or
  `{ "state": "opens", "opensAt", "spots" }` when online registration opens
  later (`opensAt` in ISO 8601, or `null` if the City's time can't be read).
- `days`, `time` and `dates` are worded as the site shows them; `""` if the
  City doesn't say.
- `started`: already under way; you can often still join.
- `next` is the path of the next page, or `null` on the last one.

Shared caches may reuse a response for up to a minute.

## `GET /api/programs/filters`

The ids `/api/programs` filters by, each list sorted by name (seasons as the
City lists them, past ones too).

```json
{
  "locations": [{ "id": 287, "name": "Adamson Estate" }],
  "categories": [{ "id": "47", "label": "Arts" }],
  "seasons": [{ "id": "27", "label": "2026 Winter" }]
}
```

Cached for a day.
