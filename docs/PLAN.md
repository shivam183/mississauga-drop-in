# Plan: Mississauga Drop-In (repo `mississauga-drop-in`)

## Context

The City's ActiveMississauga site (ActiveNet) makes drop-in programs and enrollable activities hard to browse. This project pulls the same public data and shows it better, mainly on phones. Every result shows its **time** and **community centre** clearly. For online-enrollable activities (calendar 3) it also shows the **current number of spots left** and an **Enrol button** that opens the City's enrolment page. It will be open source on GitHub.

There are two earlier attempts. Both are reference only (the user chose a fresh scaffold), and both stay untouched:

- `C:\Github Projects\Active_Mississauga_But_Better`: a 100-line Node script (`backend/server.js`) that proved the JSON API works without any auth. It queried calendar 3, but only one centre, and had a hard-coded "Pickle" filter.
- `C:\Users\shivam\Downloads\active-mississauga-but-better`: a fuller Next.js prototype with no git history. Its `docs/api.md`, `src/api/client.ts`, `src/models/enrolment.ts` and `tests/fixtures/button-status.*.json` are the best record of the API. We will use its logic as a reference, not copy the files.

**Name:** repo `mississauga-drop-in`, display name "Mississauga Drop-In". It avoids the City's brand, and the README says it is unofficial.
**Location:** `C:\Github Projects\mississauga-drop-in\`. This plan is kept in sync with `docs/PLAN.md` there.

## Decisions (from the user)

- **Mobile-first.** The phone layout is the main design, and desktop is the enhancement.
- **Time and centre are the most prominent things on each result.**
- **One merged list** of calendars 1 and 3. Each row has a badge, either **Drop-in** or **Enrol online**, and a filter chip can show just one type.
- **Calendar 3 rows** show spots left and an Enrol button.
- **Spots left** is cached for **60 seconds**. Each count shows "as of 3:42 pm", and a refresh button fetches new counts.

## Data source

This is the unofficial ActiveNet JSON API. It needs no auth, and only our server calls it. Base URL: `https://anc.ca.apm.activecommunities.com/activemississauga/rest`

| Purpose      | Call                                                                                                         | Used for                                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Centres      | `POST /onlinecalendar/filters?locale=en-US` with body `{calendar_id:"1"}` or `"3"` (a string)                | `body.center[]`, kept as a separate list per calendar                                                                                                                                                    |
| Events       | `POST /onlinecalendar/multicenter/events` with `calendar_id` 1 or 3 (a number) and `center_ids[]` in batches | `title`, `start_time`/`end_time` (`YYYY-MM-DD HH:mm:ss`, Toronto time), `facilities[]`, `activity_detail_url`, activity id                                                                               |
| Spots left   | `GET /activity/detail/{id}?locale=en-US`                                                                     | `body.detail.space_status`: either `"Full"` or `"N openings remaining"` (confirmed by the user). The count is **per session**.                                                                           |
| Enrol status | `GET /activity/detail/buttonstatus/{id}?selected_date=YYYY-MM-DD HH:mm:ss&locale=en-US`                      | `action_link.href` (the Enrol URL, for example `.../activity/search/enroll/155514`), `activity_online_start_time` (when enrolment opens) and `notification` (HTML, for example "This activity is full…") |

The calendar 3 enrol state comes from `buttonstatus` and `detail` combined. `buttonstatus` gets the next upcoming session start as `selected_date`.

- **Enrol now:** there is an `href`, the opening time is in the past, and the activity isn't full. The button opens `href`.
- **Opens {date}:** the opening time is in the future. The button is disabled.
- **Full:** `space_status` is "Full" for that session, or the notice says "full". There is no button, but a link to the City page remains.
- **Unknown:** the lookup failed. Show "Check on ActiveMississauga" and link to `activity_detail_url`.

Only https `*.activecommunities.com` URLs are allowed as links. The notice HTML is turned into plain text and never rendered as markup.

Open questions to settle in Phase 1 using real responses:

- The date format for `search_start_time`/`search_end_time`
- How many centres one events request accepts
- Whether calendar 3 events have the same shape as calendar 1's
- **Which request returns the count for one session.** The count is per session, but `/activity/detail/{id}` is keyed by activity. Check whether it, or `buttonstatus`, takes `selected_date` to pick the session, and whether the events response or `event_item_id` holds it directly. Cache and look up counts by `(activityId, sessionStart)`, not by activity alone.

Settled by the user:

- `space_status` is per session.
- `space_status` is either "Full" or "N openings remaining".

## Tech stack

- **Next.js (App Router) + TypeScript + React**, rendered on the server and styled with CSS modules.
- **Caching:** use Next's data cache. Schedules are revalidated every 10 minutes. Detail and button status use `revalidate: 60`, and the refresh button bypasses the cache with `?fresh=1`, rate-limited per IP.
- **Load on the City's servers:** request starts are throttled to at most 2 per second, with at most 4 lookups in flight at once.
- **Tooling:** Vitest, ESLint and Prettier, Node 22.
- **Hosting:** Vercel.

## Mobile-first result card

```
┌──────────────────────────────────────┐
│ 7:00 – 9:00 PM          [Enrol online]│  ← time: largest text
│ Pickleball – Adult 18+                │
│ 📍 Meadowvale Community Centre · Gym 2 │  ← centre: bold, second line
│ 12 spots left · as of 3:42 pm  ↻      │  ← calendar 3 only
│ [        Enrol now →        ]         │  ← full-width, ≥44px tap target
└──────────────────────────────────────┘
```

- Results are grouped under sticky day headers ("Today · Sat Nov 14").
- **Phone:** filters sit in a bottom sheet behind a "Filters" button. Desktop shows them in a sidebar.
- **Filters:** type chips for All, Drop-in and Enrol online.
- Times are always shown in Toronto time with am/pm.
- There is no horizontal scrolling at 360px width.
- The default font is 16px, and contrast meets WCAG AA in light and dark mode.
- Spots-left colour: green for more than 5, amber for 1–5, red for full. The text label is always shown too, so colour is never the only signal.

## Directory structure (open source conventions)

```
mississauga-drop-in/
├── .github/ ISSUE_TEMPLATE/{bug_report,feature_request,config}.yml
│           workflows/ci.yml  PULL_REQUEST_TEMPLATE.md  dependabot.yml
├── docs/ PLAN.md  architecture.md  data-source.md
├── public/
├── scripts/ capture-fixtures.ts  update-centres.ts
├── data/ centres.dropin.json  centres.enrol.json
├── src/
│   ├── app/            # /, /centres, /centres/[id], /calendar, /api/*
│   ├── components/     # SessionCard, DayGroup, FilterSheet, TypeBadge, SpotsLeft, EnrolButton
│   ├── lib/activenet/  # client.ts, types.ts, throttle.ts (raw API only)
│   ├── lib/            # schedule service, enrolment service, dates, search, params
│   └── models/         # Session, Centre, Availability, EnrolState (pure functions)
├── tests/ unit/*.test.ts  fixtures/*.json
├── .editorconfig .env.example .gitignore .nvmrc .prettierrc
├── CHANGELOG.md CODE_OF_CONDUCT.md CONTRIBUTING.md LICENSE (MIT) README.md SECURITY.md
└── package.json tsconfig.json next.config.ts eslint.config.mjs vitest.config.ts
```

## Phases

**0. Repo skeleton**

- Run `git init`, scaffold Next.js, add the OSS files and a README with the disclaimer, and make the first commit.

**1. Data layer + verify the API**

- Write `lib/activenet/client.ts` with `getFilters`, `getEvents`, `getActivityDetail` and `getButtonStatus`, plus the throttle.
- Use `capture-fixtures.ts` to record real responses for **both** calendars and all four endpoints, including one enrollable activity and one full activity.
- Answer the open questions and write the answers into `docs/data-source.md`.

**2. Domain**

- Normalise events into `Session {id, type: "dropin"|"enrol", title, centreId, centreName, facility, start, end, activityId, url}`.
- Merge both calendars into one list sorted by start time.
- Filter by text, type, centre, date and time of day, and group by day.
- `parseSpaces(space_status)` returns:
  - `{count: 0, level: "full"}` for "Full"
  - `{count: N, level: N <= 5 ? "few" : "open"}` for "N openings remaining"
  - `unknown` for anything else, logged so new wording gets noticed
- Each session card shows its own count.
- `toEnrolState(buttonStatus, detail, now)` returns `enrol | opens | full | unknown`.

**3. UI**

- Build the mobile card and day groups described above.
- `SpotsLeft` and `EnrolButton` are client components. They load counts in batches from `/api/availability` after the page renders, show skeletons while loading, show a visible error if a lookup fails, and include the refresh button.
- Add the centre pages and a week view.
- All filter state lives in the URL.

**4. Public JSON API**

- `GET /api/centres`, `/api/sessions?type=&q=&centre=&from=&to=` and `/api/availability?ids=&fresh=`, with limits on how much each returns.

**5. Quality + release**

- Unit tests built from real fixtures. Key cases: `parseSpaces`, `toEnrolState` with times before and after the opening time, the full notice, and link safety.
- CI, deploy to Vercel, and tag `v0.1.0`.
- Create the GitHub repo and push, after confirming with the user.

**Later:** favourites, an `.ics` calendar export, a PWA, and "notify me when spots open".

## Verification

- `npm run lint && npm run typecheck && npm test && npm run build` pass.
- `npm run capture-fixtures` gets live data for calendars 1 and 3.
- **Manual checks in `npm run dev`** (Chrome devtools, iPhone SE width of 375px):
  - Searching "pickleball" shows Enrol online rows. Each has a time and centre you can read at a glance, a spots-left count with "as of", and an Enrol button that opens the right ActiveMississauga enrol page.
  - A full session shows "Full" with no Enrol button, while other sessions of the same activity still show their own counts.
  - The refresh button updates the count.
  - Drop-in rows have no Enrol button.
- Lighthouse mobile accessibility and performance scores are both at least 90.
