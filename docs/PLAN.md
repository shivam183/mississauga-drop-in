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
| Events       | `POST /onlinecalendar/multicenter/events` with `calendar_id` 1 or 3 (a number) and `center_ids[]` in batches | `title`, `start_time`/`end_time` (`YYYY-MM-DD HH:mm:ss`, Toronto time), `facilities[]`, `activity_detail_url`, `event_item_id` (activity id)                                                             |
| Spots left   | `GET /activity/detail/{id}?locale=en-US`                                                                     | `body.detail.space_status`: either `"Full"` or `"N openings remaining"`. Per session for calendar 3; for calendar 1 it covers the whole run, so it isn't shown.                                          |
| Enrol status | `GET /activity/detail/buttonstatus/{id}?selected_date=YYYY-MM-DD HH:mm:ss&locale=en-US`                      | `action_link.href` (the Enrol URL, for example `.../activity/search/enroll/155514`), `activity_online_start_time` (when enrolment opens) and `notification` (HTML, for example "This activity is full…") |

Full details, with the live responses that confirm them, are in `docs/data-source.md`.

The calendar 3 enrol state comes from `buttonstatus` and `detail` combined. `buttonstatus` is called with the session's own start as `selected_date`.

- **Enrol now:** there is an `href`, the opening time is **empty or in the past** (it is `""` once enrolment is open), and `space_status` isn't "Full". The button opens `href`.
- **Opens {date}:** there is an `href` and the opening time is in the future (seen: 7 am the day before the session). The button is disabled.
- **Full:** `space_status` is "Full" for that session, or the notice says "full". There is no button, but a link to the City page remains.
- **Closed:** any other notice with no `href`, such as "this activity is over". There is no button, and the notice is shown as plain text.
- **Unknown:** the lookup failed. Show "Check on ActiveMississauga" and link to `activity_detail_url`.

Only https `*.activecommunities.com` URLs are allowed as links. The notice HTML is turned into plain text and never rendered as markup.

Answered in Phase 1 (see `docs/data-source.md`):

- **Date range:** `search_start_time` and `search_end_time` are ignored in every format tried. The API always returns its whole window (the Monday of this week to about 6–8 weeks ahead), so the app filters by date itself.
- **Centres per request:** any number, with no paging. But calendar 1 with all 21 centres is about **12 MB**, so requests are batched (about 5 centres each), and the cache stores normalised sessions, not raw responses.
- **Calendar 3 shape:** the same as calendar 1. On 2026-11-14 it held only "Drop In Adult Pickleball" (about 480 sessions at 10 centres).
- **Spots for one session:** in calendar 3, **every session has its own `event_item_id`**, so `/activity/detail/{event_item_id}` is already per session, and counts are cached by `event_item_id`. No `selected_date` is needed for detail.

## Tech stack

- **Next.js (App Router) + TypeScript + React**, rendered on the server and styled with CSS modules.
- **Caching:** this Next.js version uses Cache Components (`cacheComponents: true`), so caching uses `"use cache"` with `cacheLife` in the `src/lib/` services, not `fetch` revalidate options. The ActiveNet client itself never caches. Normalised schedules are cached for 10 minutes, and spot counts and button status for 60 seconds. The refresh button bypasses the cache with `?fresh=1`, rate-limited per IP.
- **Load on the City's servers:** request starts are throttled to at most 2 per second, with at most 4 lookups in flight at once (per server process).
- **Tooling:** Vitest, ESLint and Prettier, Node 22.
- **Hosting:** Vercel, connected through its GitHub integration. Every PR gets a preview URL, and every merge to `main` deploys to production.

## GitHub automation

| Workflow                   | Trigger                         | What it does                                                                                                                                                                                |
| -------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                   | push to `main`, PRs             | lint, format check, typecheck, test, build                                                                                                                                                  |
| `pr-title.yml`             | PR opened/edited                | Requires a Conventional Commit PR title (`feat:`, `fix(enrol):` …). PRs are squash-merged, so the title becomes the commit message on `main`.                                               |
| `release-please.yml`       | push to `main`                  | Keeps a release PR open with the next version and `CHANGELOG.md`. Merging it tags `vX.Y.Z` and publishes a GitHub Release. `feat` bumps 0.x minor.                                          |
| `codeql.yml`               | push to `main`, PRs, weekly     | CodeQL security scan (`security-extended` queries)                                                                                                                                          |
| `dependabot-automerge.yml` | Dependabot PRs                  | Auto-merges patch updates, and minor updates to dev dependencies and Actions, once required checks pass. Major updates wait for a human.                                                    |
| `api-health.yml`           | nightly cron, manual            | `npm run check-api`: 8 requests covering all four endpoints. Fails if a response shape or the `space_status` wording changes, so a broken unofficial API is noticed before users notice it. |
| `update-centres.yml`       | weekly cron, manual             | Runs `scripts/update-centres.ts` and opens a PR if `data/centres.*.json` changed                                                                                                            |
| `lighthouse.yml` _(Ph. 3)_ | Vercel preview deployment ready | Lighthouse CI on the preview URL; fails below 90 for mobile accessibility or performance                                                                                                    |

Dependabot (`dependabot.yml`) uses Conventional Commit prefixes (`fix(deps)`, `chore(deps)`, `ci(deps)`), so its PRs pass the title check.

### One-time setup on GitHub and Vercel (done by hand)

1. Create the public GitHub repo and push.
2. **Settings → General:** allow squash merging only, use the PR title as the default commit message, enable "Allow auto-merge" and "Automatically delete head branches".
3. **Settings → Actions → General:** set workflow permissions to "Read and write" and tick "Allow GitHub Actions to create and approve pull requests" (release-please needs this).
4. **Settings → Rules → Rulesets:** for `main`, require a pull request and the status checks `check` (CI), `conventional-title` and `analyze` (CodeQL), and block force pushes.
5. **Settings → Code security:** turn on Dependabot alerts, Dependabot security updates, secret scanning and push protection.
6. **Release PR CI:** add a fine-grained PAT (contents and pull requests: read/write on this repo) as the `RELEASE_PLEASE_TOKEN` secret. Without it the release PR gets no CI run and can't pass the ruleset.
7. **Vercel:** import the repo, keep the Next.js defaults, set the production branch to `main`, and enable PR comments for preview URLs.

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
│           workflows/{ci,pr-title,release-please,codeql,dependabot-automerge}.yml
│           workflows/{api-health,update-centres}.yml  workflows/lighthouse.yml (Phase 3)
│           PULL_REQUEST_TEMPLATE.md  dependabot.yml
├── docs/ PLAN.md  architecture.md  data-source.md
├── public/
├── scripts/ capture-fixtures.ts  update-centres.ts  check-api.ts  lib.ts
├── data/ centres.dropin.json  centres.enrol.json
├── src/
│   ├── app/            # /, /centres, /centres/[id], /api/*
│   ├── components/     # SessionCard, DayGroup, FilterSheet, TypeBadge, SpotsLeft, EnrolButton
│   ├── lib/activenet/  # client.ts, types.ts, validate.ts, throttle.ts (raw API only)
│   ├── lib/            # schedule service, enrolment service, dates, search, params
│   └── models/         # Session, Centre, Availability, EnrolState (pure functions)
├── tests/ unit/*.test.ts  fixtures/*.json
├── .editorconfig .env.example .gitignore .nvmrc .prettierrc
├── CHANGELOG.md CODE_OF_CONDUCT.md CONTRIBUTING.md LICENSE (MIT) README.md SECURITY.md
├── release-please-config.json .release-please-manifest.json
└── package.json tsconfig.json next.config.ts eslint.config.mjs vitest.config.ts
```

## Phases

**0. Repo skeleton** ✅

- Run `git init`, scaffold Next.js, add the OSS files and a README with the disclaimer, and make the first commit.
- Add the GitHub automation: release-please, the PR title check, CodeQL and Dependabot auto-merge. CONTRIBUTING and the PR template now ask for Conventional Commit titles, and `CHANGELOG.md` is generated.

**1. Data layer + verify the API** ✅

- Write `lib/activenet/client.ts` with `getFilters`, `getEvents`, `getActivityDetail` and `getButtonStatus`, plus the throttle.
- Use `capture-fixtures.ts` to record real responses for **both** calendars and all four endpoints, including one enrollable activity and one full activity.
- Answer the open questions and write the answers into `docs/data-source.md`.
- Add `api-health.yml` (a nightly shape check using the same client, with at most a handful of requests) and `update-centres.yml`.
- Done: the client validates every response shape at runtime (`validate.ts`) and throws `ActiveNetError` or `ActiveNetShapeError`. Fixtures and their manifest are in `tests/fixtures/`. The unit tests cover the throttle, the client and the API facts from the fixtures.

**2. Domain** ✅

- Normalise events into `Session {id, type: "dropin"|"enrol", title, centreId, centreName, facility, start, end, activityId, url}`.
- Merge both calendars into one list sorted by start time.
- Filter by text, type, centre, date and time of day, and group by day.
- `parseSpaces(space_status)` returns:
  - `{count: 0, level: "full"}` for "Full"
  - `{count: N, level: N <= 5 ? "few" : "open"}` for "N openings remaining"
  - `unknown` for anything else, logged so new wording gets noticed
- Each session card shows its own count.
- `toEnrolState(status, now)` returns `enrol | opens | full | closed | unknown`, where `status` comes from `toSessionStatus(detail, buttonStatus)`. The status is cached and the state is worked out when shown, because "opens at 7 am" depends on the current time.
- Fetch schedules in batches of about 5 centres, drop sessions that have already ended, and cache the normalised sessions (not the raw 12 MB response) with `"use cache"` and `cacheLife`.
- Done: models in `src/models/` (`session`, `availability`, `filters`, `links`), services in `src/lib/` (`schedule`, `availability`, `centres`), and cache profiles `schedule` (10 min) and `spots` (60 s) in `next.config.ts`. Spots left are cached for 60 s; the enrol link and opening time for 10 min, so the refresh button costs one request per session. Availability lookups accept only ids of upcoming calendar 3 sessions (at most 20 per call). Facility names have the centre prefix removed ("Churchill Mdws CC Gym 2" becomes "Gym 2"); all 133 real names were checked.
- Live check (2026-11-14): 9,319 sessions load in about 3 s cold and 25 ms cached. Availability for 3 sessions takes about 3 s cold, because of the 2-requests-per-second throttle, and 12 ms cached.

**3. UI** ✅

- Build the mobile card and day groups described above.
- `SpotsLeft` and `EnrolButton` are client components. They load counts in batches from `/api/availability` after the page renders, only for cards that are on screen (a cold lookup takes about 1 s per session because of the throttle), show skeletons while loading, show a visible error if a lookup fails, and include the refresh button.
- Add the centre pages. (A week view was built, then removed: the day-grouped list and date filter cover it.)
- All filter state lives in the URL.
- Add `lighthouse.yml` to run Lighthouse CI against each Vercel preview.
- Done: pages `/`, `/centres` and `/centres/[id]` (prerendered for every centre). The header is just the site name, with no nav tabs; centre pages are reached from the centre name on each card. Search updates the results 300 ms after typing pauses (no Search button; Enter searches at once), and Enrol now opens the City's page in a new tab. The static shell renders first and results stream in. The search box, type chips and filter form are plain GET forms and links, so everything works without JavaScript except the phone filter sheet and live spot counts (a `<noscript>` link to the City page is shown instead). `/api/availability` is built here because the cards need it: at most 20 ids per call, and `fresh=1` is limited to 10 per IP per minute (429 after that). 30 results per page with "Show more".
- Checked in a production build: no horizontal scroll at 375px, light and dark mode, and real data (spots, Full, Enrol now, Opens …). Local Lighthouse mobile: performance 97–99, accessibility 100, best practices 100, SEO 100. Showing 50 results per page scored 89, so the page size is 30.

**4. Public JSON API** ✅

- `GET /api/centres`, `/api/sessions?type=&q=&centre=&from=&to=` and `/api/availability?ids=&fresh=`, with limits on how much each returns.
- Done: documented in `docs/api.md`. `/api/centres` is static. `/api/sessions` takes the site's filters plus `limit` (1–200, default 50) and `offset`, returns `total` and a `next` link, and lets shared caches keep it for 60 s. `/api/availability` also returns the worked-out `enrol` state per session. Times are ISO 8601 with Toronto's offset. All three allow calls from any website (CORS `*`, plain GETs). The response shapes are a public contract, separate from the internal `Session` type.

**5. Quality + release**

- Unit tests built from real fixtures. Key cases: `parseSpaces`, `toEnrolState` with times before and after the opening time, the full notice, and link safety.
- Create the GitHub repo and push, after confirming with the user, then do the one-time setup steps under **GitHub automation**.
- Connect Vercel. `v0.1.0` comes from merging the first release-please PR, not from tagging by hand.

**Later:** favourites, an `.ics` calendar export, a PWA, and "notify me when spots open".

## Verification

- `npm run lint && npm run typecheck && npm test && npm run build` pass.
- `npm run e2e` passes: Playwright (Chromium, 375px phone and desktop) against a production build and a mock of the City API (`e2e/mock-activenet.mjs`). It covers sideways scrolling, chips, search, the filter sheet, spots, Full, Enrol now, refresh, centre pages, search-as-you-type and Enrol now opening a new tab. CI runs it in `.github/workflows/playwright.yml`.
- `npm run capture-fixtures` gets live data for calendars 1 and 3.
- **Manual checks in `npm run dev`** (Chrome devtools, iPhone SE width of 375px):
  - Searching "pickleball" shows Enrol online rows. Each has a time and centre you can read at a glance, a spots-left count with "as of", and an Enrol button that opens the right ActiveMississauga enrol page.
  - A full session shows "Full" with no Enrol button, while other sessions of the same activity still show their own counts.
  - The refresh button updates the count.
  - Drop-in rows have no Enrol button.
- Lighthouse mobile accessibility and performance scores are both at least 90.
