# Plan: Mississauga Drop-In (repo `mississauga-drop-in`)

## Context

The City's ActiveMississauga site (ActiveNet) makes drop-in programs and enrollable activities hard to browse. This project pulls the same public data and shows it better, mainly on phones. Every result shows its **time** and **community centre** clearly. For online-enrollable activities (calendar 3) it also shows the **current number of spots left** and an **Enroll button** that opens the City's enrollment page. It will be open source on GitHub.

There were two earlier private attempts, used as reference only (this repo is a fresh scaffold): a 100-line Node script that proved the JSON API works without any auth, and a fuller Next.js prototype whose API notes and fixtures were the best record of the API. Their logic was used as a reference; no files were copied.

**Name:** repo `mississauga-drop-in`, display name "Mississauga Drop-In". It avoids the City's brand, and the README says it is unofficial.

## Decisions (from the user)

- **Mobile-first.** The phone layout is the main design, and desktop is the enhancement.
- **Time and centre are the most prominent things on each result.**
- **One merged list** of calendars 1 and 3. Each row has a badge, either **Drop-in** or **Enroll online**, and a filter chip can show just one type.
- **Calendar 3 rows** show spots left and an Enroll button.
- **Spots left** is cached for **60 seconds**. Each count shows "as of 3:42 pm", and a refresh button fetches new counts.

## Data source

This is the unofficial ActiveNet JSON API. It needs no auth, and only our server calls it. Base URL: `https://anc.ca.apm.activecommunities.com/activemississauga/rest`

| Purpose       | Call                                                                                                         | Used for                                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Centres       | `POST /onlinecalendar/filters?locale=en-US` with body `{calendar_id:"1"}` or `"3"` (a string)                | `body.center[]`, kept as a separate list per calendar                                                                                                                                                      |
| Events        | `POST /onlinecalendar/multicenter/events` with `calendar_id` 1 or 3 (a number) and `center_ids[]` in batches | `title`, `start_time`/`end_time` (`YYYY-MM-DD HH:mm:ss`, Toronto time), `facilities[]`, `activity_detail_url`, `event_item_id` (activity id)                                                               |
| Spots left    | `GET /activity/detail/{id}?locale=en-US`                                                                     | `body.detail.space_status`: either `"Full"` or `"N openings remaining"`. Per session for calendar 3; for calendar 1 it covers the whole run, so it isn't shown.                                            |
| Enroll status | `GET /activity/detail/buttonstatus/{id}?selected_date=YYYY-MM-DD HH:mm:ss&locale=en-US`                      | `action_link.href` (the Enroll URL, for example `.../activity/search/enroll/155514`), `activity_online_start_time` (when enrollment opens) and `notification` (HTML, for example "This activity is full…") |

Full details, with the live responses that confirm them, are in `docs/data-source.md`.

The calendar 3 enroll state comes from `buttonstatus` and `detail` combined. `buttonstatus` is called with the session's own start as `selected_date`.

- **Enroll now:** there is an `href`, the opening time is **empty or in the past** (it is `""` once enrollment is open), and `space_status` isn't "Full". The button opens `href`.
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
- **Caching:** this Next.js version uses Cache Components (`cacheComponents: true`), so caching uses `"use cache"` with `cacheLife` in the `src/lib/` services, not `fetch` revalidate options. The ActiveNet client itself never caches. Normalised schedules and button status (enroll link, opening time) are cached for 10 minutes, and spot counts for 60 seconds. The refresh button bypasses the cache with `?fresh=1`, rate-limited per IP.
  - **Two layers** (#17, #44): each lookup checks the server's own memory first (`"use cache"`, free), then Vercel's shared Runtime Cache (`"use cache: remote"`, billed per 8 KB read). Memory alone isn't enough on serverless (every cold server refetched from the City, 3–6 s per page, fixed in #17); remote alone is costly. A value can be up to about twice its lifetime old.
  - **Small entries** (#45): the Runtime Cache rejects items over **2 MB** (HTTP 413). The merged schedule is stored packed by activity (`packSessions`): about 780 KB instead of 3.4 MB. Keep any new remote entry well under 2 MB, and check its size against live data.
  - Details and the cache table are in `docs/architecture.md`.
- **Load on the City's servers:** request starts are throttled to at most 2 per second, with at most 4 lookups in flight at once (per server process).
- **Tooling:** Vitest, ESLint and Prettier, Node 22.
- **Hosting:** Vercel (free Hobby plan), connected through its GitHub integration. Every PR gets a preview URL, and every merge to `main` deploys to production at https://mississaugadropin.com.

### Hosting limits

The Hobby plan includes **1M Runtime Cache read units a month** (1 unit = 8 KB read), shared by all projects on the team. Going over isn't billed: the Runtime Cache is paused until the period resets, and the site falls back to server memory and the City's API (an occasional 3–6 s first load on a cold server, more requests to the City).

**Incident, 2026-11-14 to 16:** the full 1M units were used in about two days, and the cache was paused on 2026-11-16 until the period resets (about 2026-12-14; check Vercel → Usage).

- **Cause:** the merged schedule (3.4 MB) was over the 2 MB item limit, so it was never stored (`413` in the runtime logs). Every page render that missed memory read all the centre batches (about 426 units) and then failed to save the result. Most reads came in bursts right after deploys, when every cache starts empty.
- **Fixes:** #44 (memory in front of the remote cache) and #45 (packed schedule, under 2 MB, confirmed with no `413` after deploy).
- **Lessons:** measure the size of anything stored in the remote cache; every deploy empties the cache, so batch changes into fewer deploys; the free plan has 1 hour of runtime logs and no usage metrics by function, so check the runtime logs soon after a deploy.
- **Before a publicity push** (such as a Reddit post): make sure the Runtime Cache isn't paused, or be on Pro for that month.

## GitHub automation

| Workflow                   | Trigger                         | What it does                                                                                                                                                                                                                                            |
| -------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                   | push to `main`, PRs             | lint, format check, typecheck, test, build                                                                                                                                                                                                              |
| `pr-title.yml`             | PR opened/edited                | Requires a Conventional Commit PR title (`feat:`, `fix(enroll):` …). PRs are squash-merged, so the title becomes the commit message on `main`. Runs on `pull_request`, not `pull_request_target`, which GitHub blocks on public repos by default (#46). |
| `release-please.yml`       | push to `main`                  | Keeps a release PR open with the next version and `CHANGELOG.md`. Merging it tags `vX.Y.Z` and publishes a GitHub Release. `feat` bumps 0.x minor.                                                                                                      |
| `codeql.yml`               | push to `main`, PRs, weekly     | CodeQL security scan (`security-extended` queries)                                                                                                                                                                                                      |
| `dependabot-automerge.yml` | Dependabot PRs                  | Auto-merges patch updates, and minor updates to dev dependencies and Actions, once required checks pass. Major updates wait for a human.                                                                                                                |
| `api-health.yml`           | nightly cron, manual            | `npm run check-api`: 8 requests covering all four endpoints. Fails if a response shape or the `space_status` wording changes, so a broken unofficial API is noticed before users notice it.                                                             |
| `update-centres.yml`       | weekly cron, manual             | Runs `scripts/update-centres.ts` and opens a PR if `data/centres.*.json` changed                                                                                                                                                                        |
| `lighthouse.yml` _(Ph. 3)_ | Vercel preview deployment ready | Lighthouse CI on the preview URL; fails below 90 for mobile accessibility or performance                                                                                                                                                                |

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
│ 7:00 – 9:00 PM          [Enroll online]│  ← time: largest text
│ Pickleball – Adult 18+                │
│ 📍 Meadowvale Community Centre · Gym 2 │  ← centre: bold, second line
│ 12 spots left · as of 3:42 pm  ↻      │  ← calendar 3 only
│ [        Enroll now →        ]         │  ← full-width, ≥44px tap target
└──────────────────────────────────────┘
```

- Results are grouped under sticky day headers ("Today · Sat Nov 14").
- **Phone:** filters sit in a bottom sheet behind a "Filters" button. Desktop shows them in a sidebar.
- **Filters:** activity chips (Pickleball, Swim…) above the list; type (Drop-in or Enroll online) is in the filter sheet.
- **Time labels:** a session that's under way says **On now** (amber); one starting within the hour says **Starts in N min** (green at 15 min or less, blue up to 60). Worked out when the page renders, so it can be a few minutes stale if the page sits open.
- **Share:** each card has a share icon. Phones open the share sheet; elsewhere it copies the same text. The message is one detail per line (title, day and time, centre, link), and the link (`/?session=<id>`) opens exactly that session.
- Times are always shown in Toronto time with am/pm.
- There is no horizontal scrolling at 360px width.
- The default font is 16px, and contrast meets WCAG AA in light and dark mode.
- Spots-left colour: green for more than 5, amber for 1–5, red for full. The text label is always shown too, so colour is never the only signal.
- **Loading placeholders** (result cards on first load or when a collapsed day reopens, the spots-left bar and the Enroll button) are grey shapes with a light band sweeping left to right while their data is loading (not while a card waits off screen). The band is a moving pseudo-element, so it doesn't repaint, and it's off for anyone who prefers reduced motion.

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
├── data/ centres.dropin.json  centres.enroll.json
├── src/
│   ├── app/            # /, /api/*
│   ├── components/     # SessionCard, DayGroup, FilterSheet, TypeBadge, SpotsLeft, EnrollButton
│   ├── lib/activenet/  # client.ts, types.ts, validate.ts, throttle.ts (raw API only)
│   ├── lib/            # schedule service, enrollment service, dates, search, params
│   └── models/         # Session, Centre, Availability, EnrollState (pure functions)
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

- Normalise events into `Session {id, type: "dropin"|"enroll", title, centreId, centreName, facility, start, end, activityId, url}`.
- Merge both calendars into one list sorted by start time.
- Filter by text, type, centre, date and time of day, and group by day.
- `parseSpaces(space_status)` returns:
  - `{count: 0, level: "full"}` for "Full"
  - `{count: N, level: N <= 5 ? "few" : "open"}` for "N openings remaining"
  - `unknown` for anything else, logged so new wording gets noticed
- Each session card shows its own count.
- `toEnrollState(status, now)` returns `enroll | opens | full | closed | unknown`, where `status` comes from `toSessionStatus(detail, buttonStatus)`. The status is cached and the state is worked out when shown, because "opens at 7 am" depends on the current time.
- Fetch schedules in batches of about 5 centres, drop sessions that have already ended, and cache the normalised sessions (not the raw 12 MB response) with `"use cache"` and `cacheLife`.
- Done: models in `src/models/` (`session`, `availability`, `filters`, `links`), services in `src/lib/` (`schedule`, `availability`, `centres`), and cache profiles `schedule` (10 min) and `spots` (60 s) in `next.config.ts`. Spots left are cached for 60 s; the enroll link and opening time for 10 min, so the refresh button costs one request per session. Availability lookups accept only ids of upcoming calendar 3 sessions (at most 20 per call). Facility names have the centre prefix removed ("Churchill Mdws CC Gym 2" becomes "Gym 2"); all 133 real names were checked.
- Live check (2026-11-14): 9,319 sessions load in about 3 s cold and 25 ms cached. Availability for 3 sessions takes about 3 s cold, because of the 2-requests-per-second throttle, and 12 ms cached.

**3. UI** ✅

- Build the mobile card and day groups described above.
- `SpotsLeft` and `EnrollButton` are client components. They load counts in batches from `/api/availability` after the page renders, only for cards that are on screen (a cold lookup takes about 1 s per session because of the throttle), show skeletons while loading, show a visible error if a lookup fails, and include the refresh button.
- Centre pages and a week view were built, then removed: the centre filter (a card's centre name adds it) and the day-grouped list cover them.
- All filter state lives in the URL.
- Add `lighthouse.yml` to run Lighthouse CI against each Vercel preview.
- Done: one page, `/`. The header is just the site name and a GitHub icon. Tapping a card opens the City's details page; a card's centre name adds that centre to the filter. Search updates the results 300 ms after typing pauses (no Search button; Enter searches at once), and Enroll now opens the City's page in a new tab. The static shell renders first and results stream in. The search box, chips and filter form are plain GET forms and links, so everything works without JavaScript except the phone filter sheet and live spot counts (a `<noscript>` link to the City page is shown instead). `/api/availability` is built here because the cards need it: at most 20 ids per call, and `fresh=1` is limited to 10 per IP per minute (429 after that). 30 results per page with "Show more".
- Checked in a production build: no horizontal scroll at 375px, light and dark mode, and real data (spots, Full, Enroll now, Opens …). Local Lighthouse mobile: performance 97–99, accessibility 100, best practices 100, SEO 100. Showing 50 results per page scored 89, so the page size is 30.

**4. Public JSON API** ✅

- `GET /api/centres`, `/api/sessions?type=&q=&centre=&from=&to=` and `/api/availability?ids=&fresh=`, with limits on how much each returns.
- Done: documented in `docs/api.md`. `/api/centres` is static. `/api/sessions` takes the site's filters plus `limit` (1–200, default 50) and `offset`, returns `total` and a `next` link, and lets shared caches keep it for 60 s. `/api/availability` also returns the worked-out `enroll` state per session. Times are ISO 8601 with Toronto's offset. All three allow calls from any website (CORS `*`, plain GETs). The response shapes are a public contract, separate from the internal `Session` type.

**5. Quality + release** ✅

- Unit tests built from real fixtures. Key cases: `parseSpaces`, `toEnrollState` with times before and after the opening time, the full notice, and link safety.
- Create the GitHub repo and push, after confirming with the user, then do the one-time setup steps under **GitHub automation**.
- Connect Vercel. `v0.1.0` comes from merging the first release-please PR, not from tagging by hand.
- Progress (2026-11-14):
  - Done: unit tests from real fixtures (127), Playwright e2e (42), Vercel connected (https://mississaugadropin.com).
  - Done: security headers (CSP, nosniff, Referrer-Policy, Permissions-Policy) with an e2e check; `npm audit` clean.
  - Done: live Lighthouse mobile scores 92–99 for performance and 100 for accessibility, best practices and SEO.
  - Done: squash-only merges with the PR title, auto-merge, and merged branches deleted.
  - Done: `v0.1.0` released (https://github.com/shivam183/mississauga-drop-in/releases/tag/v0.1.0).
  - Done: the "Protect main" ruleset requires a PR (squash only) and passing `check`, `e2e`, `analyze` and `conventional-title`, and blocks deletion and force pushes. All changes now go through PRs.
  - Done: the `RELEASE_PLEASE_TOKEN` secret (a fine-grained PAT) is set, so release PRs get their checks. Renew it before it expires.

**6. Find it faster** ✅

Goal: get a regular user from opening the site to the session they want in as few taps as possible, without accounts and without new data from the City.

- ✅ **Activity chips** (#35): a row of one-tap chips (Pickleball, Swim, Yoga, Skate…) that set the search. Type moved into the filter sheet.
- ✅ **"On now" and "Starts in N min" labels** (#36). See the result card section.
- ✅ **Share button and session links** (#38, #39). See the result card section. `/api/sessions` accepts the same `session` parameter (`docs/api.md`).
- ✅ **Fix:** opening the filter sheet on a phone no longer pops up the keyboard; the sheet focuses itself, not its first field (#41).
- ❌ **"My centres" chip** (#40, closed): remembering the last centres in the browser and offering them as a chip. Decided it isn't worth adding.
- ✅ **Collapsible day sections** (#48). Summary below.
- ❌ **Week strip and header day menu** (2026-11-16, compared in an interactive mock): a row of day chips adds clutter to the home page, and chips are for activities only; a menu on the sticky day header is easy to miss and not a common pattern. Jumping to a specific day stays in the filter sheet's day picker.
- ✅ **Age group and price on the card: investigated** (2026-11-17). Ages (`age_description`, e.g. "16 yrs +") are only in `/activity/detail`, per activity, not in the events list, so showing them on every card would cost a City call per card. They go in the details popup instead (Phase 7). Fees aren't published online for drop-ins (`/activity/detail/estimateprice/{id}` returns `show_price_info_online: false` and no prices), so price is dropped.

**Collapsible day sections (done, #48).** Each day is a native `<details open>` whose sticky heading collapses or opens that day. Collapsed days don't count toward the 30-session page, so the page refills with the next sessions; their headings stay so they can be reopened. State lives in the URL (`collapsed=` dates, at most 14), survives "Show more" and is dropped by any new search. When the page is all one day, the next open day's first 5 sessions are already shown, so a collapse never leaves a blank screen; the page keeps its scroll position. Without JavaScript the days still collapse but don't refill. Covered by unit tests (page selection, `collapsed` parsing) and e2e (refill, stuck heading, keyboard, "Show more").

**7. Get found** (in progress)

Goal: people searching Google for a drop-in in Mississauga land on a page that matches their search, and can see what a program is without leaving the site.

Done (2026-11-17):

- ✅ **Search engines** (#50): static `robots.txt` (crawl everything but `/api/`) and `sitemap.xml` in `src/app/`, and a canonical URL of `/` so filter URLs aren't indexed as separate pages. The apex domain is canonical and is the primary domain in Vercel (`www.` redirects to it). Verified in Google Search Console, sitemap submitted; Bing Webmaster Tools imported from Search Console (done by hand).
- ✅ **Logo** (#51): a grey map pin with a red ring at its base and, in a white disc, a red Mississauga skyline (City Hall's clock spire and the two Absolute World towers); drawn for this site, not stock art. `src/app/icon.svg` (tab and Google result icon), `src/app/apple-icon.png` (180px, iOS home screen), and beside the site name in the header.
- ✅ **Share card and site name** (#52): `src/app/opengraph-image.tsx` builds a 1200×630 card at build time, used for Open Graph and as a large X card. The home page carries `WebSite` JSON-LD so Google shows "Mississauga Drop-In" as the site name.
- ✅ **Buy Me a Coffee** (#53): BMC's own cup logo (self-hosted `public/bmc-logo.svg`, on a circle in their yellow) right of the GitHub icon, with hover tooltips on every header logo; in the README, a logo, badges, a "Find a drop-in" button and BMC's button. A plain link, not BMC's widget script, so the CSP, speed and privacy are unchanged.

To do, in this order (batch the code PRs into few deploys: each deploy empties the Runtime Cache, which is paused until about 2026-12-14; see **Hosting limits**):

- ✅ **Activity details popup and page.** Spec below.
- ✅ **Activity type pages** (`/swim`, `/pickleball`, …). Spec below.
- ⬜ **Centre pages and Browse links** (`/centres/{slug}`). Spec below.
- ⬜ **By hand after launch:** resubmit the sitemap in Search Console and Bing; about 2–3 weeks later, check Search Console → Performance for the queries people use and pick any further landing pages from them.

**Spec: activity details popup and page**

Tapping a card's title opens a popup over the list with what the City's activity page shows; opening the same URL directly (shared link, refresh, no JavaScript) shows it as a full page.

- **Data:** `GET /activity/detail/{id}`, already called for spots, also has `catalog_description`, `age_description` ("16 yrs +,"), `allowed_gender`, `category`/`sub_category`, `season_name`, `first_date`/`last_date`, `online_notes` (HTML) / `user_notes`, `facilities[].name` and `centers[]` (address, postal code, phone, latitude/longitude). No fees (see Phase 6).
- **Model:** `src/models/activity.ts` turns the raw detail into a small plain `ActivityInfo`: name (`displayTitle`), category, ages (trailing comma removed), gender (only if not "Mixed"), season and dates, description, notes (`noticeToText`, never rendered as HTML), rooms (`roomName`) and the centre's address, phone and coordinates. Every field is optional and read defensively; `assertActivityDetailBody` doesn't change.
- **Service:** `src/lib/activity.ts` `getActivity(id)`, cached per request with React `cache` (the page's metadata and body share it). It reads that activity's sessions from a small per-activity in-memory cache of the schedule, then the City's details: drop-ins through a new `info` cache (memory then Runtime Cache, revalidate 1 day, expire 7 days, only the small `ActivityInfo`, about 1–2 KB); enroll sessions from the spots lookup's cached detail (60 s), which their popup needs anyway, so it's one City call. Only ids of upcoming sessions are looked up; anything else gets the not-found page, so the route can't be used to query the City for arbitrary ids.
- **Content** (agreed in an HTML mockup, 2026-11-17), top to bottom:
  - Drop-in/Enroll badge and ✕; the name; fact chips: category, ages, and season with dates. The **ages chip is highlighted** (accent tint, bold, 👤 icon) and gets **one sweep of shine** about 0.3 s after opening, never looped and skipped under `prefers-reduced-motion`.
  - **The tapped session:** date and time ("On now" when on), centre · room, with two small icon buttons beside the centre: **Directions** (Google Maps, by coordinates) and **Call** (`tel:`), each at least 40px with an accessible name. For enroll sessions, spots left with "as of" and refresh (the existing `SpotsLeft`) sit inside this box.
  - **Upcoming** (drop-ins): the next 4 sessions of this activity, then a summary line: "Every Tuesday until Dec 29 · 9 sessions this season" when all sessions fall on one weekday, otherwise just the count (`other_info.sessions`).
  - **About:** the description. **Good to know:** the notes as plain text (for drop-ins, the City's "no registration, first come first served" note).
  - **Where:** centre, room, the address as the Google Maps link, and the phone number labelled "(City of Mississauga)": the centres checked (Churchill Meadows, Malton) all list (905) 615-4100, the City's general line, not the centre's desk. No second set of buttons.
  - **See more** (popup and full page): "More {activity} →" and "More at {centre} →", linking to the filtered list until the activity and centre pages exist, then to those pages. From the popup, following one closes it and shows that list.
  - **A bar pinned to the bottom** (popup and full page alike), so the main action never needs scrolling: for enroll sessions the existing `EnrollButton` (Enroll now / Opens {time}, disabled / Full) with "View on ActiveMississauga" under it; for drop-ins just "View on ActiveMississauga". Enroll appears only here, not twice. Scrolled to the end, the last content keeps a 24px gap above the bar.
  - Missing fields are left out. A **Share** button in the top row (beside the ✕ on desktop) shares the details page link, `/activity/{id}?session=…`, with the name, time and centre; whoever opens it gets the full details page. The card keeps its own Share (a link to the list showing that session).
- **Routes:** `src/app/activity/[id]/page.tsx` is the full page (title "{name} at {centre}", description, `noindex, follow`, not in the sitemap). The popup is the same content through Next's intercepting and parallel routes (`src/app/@modal/(.)activity/[id]`, `@modal/default.tsx`, the `modal` slot in the root layout).
- **Popup:** a native `<dialog>` (`showModal()`, the dialog itself takes focus, Esc closes, labelled by the name; focus returns to the tapped card). Backdrop tap, Esc and Back all go back. A bottom sheet on phones, with a handle you pull down to close (shared with the filter sheet, `useSwipeToClose`) and **no ✕**; centred on desktop **with a ✕** (no handle there). Light and dark. **Full page:** the same top row, with ✕ as a plain link to `/` (it works without JavaScript and when there's no history to go back to), so it looks like the popup opened full screen. **Refresh vs shared link:** opening a card remembers, in this tab's `sessionStorage`, the popup's address, the list it came from (with filters) and its scroll position. A reload (or Back/Forward) of that address in the same tab, told apart by the page's navigation type, goes back to that list, scrolled to where it was, with the popup open over it (the stand-in covers the swap). A shared link (another tab or device) has no such memory and stays the full page. With storage blocked, a refresh just shows the full page.
- **Card:** the title links to `/activity/{id}?session=…` with `prefetch={false}` and `scroll={false}`. Tapping opens a **stand-in popup at once** in the browser with what the card already shows (name, badge, time, place) and placeholders; the real popup takes over in the same layout when the server answers. No prefetch, so cards on screen cost nothing until tapped. One spots store (`AvailabilityProvider` in the root layout) serves the list and the popup, so an enroll popup reuses the card's count.
- **Cost:** one City request per activity per day, only when a popup or page is opened (through the existing throttle). A calendar 3 session is its own activity, so its page shows one session and 404s once it has ended. If crawlers following card links show up in the logs, add `rel="nofollow"` to the title links.
- **Acceptance:**
  - Unit: `toActivityInfo` against `detail.1.json`, `detail.3.open.json` and `detail.3.full.json` (ages trimmed, "Mixed" hidden, HTML stripped from notes, no centre); `getActivityInfo` rejects ids that aren't upcoming sessions.
  - e2e (phone and desktop): tapping a card title opens the popup with name, description and address; Esc, Back and (desktop) the ✕ each close it and keep the scroll position; on phones, pulling the handle down closes it and there's no ✕; a refresh keeps the list (filters and scroll) with the popup over it, while a shared link in a new tab is the full page; it shows the card's name and time before the server answers; `/activity/{id}` loaded directly shows the full page; an unknown id shows the not-found page with `noindex` (the status is 200: the page shell is prerendered and streams before the lookup, and these pages aren't indexed anyway); an enroll session's popup and full page show spots, and Enroll is visible at 375px without scrolling; keyboard: Tab to the title, Enter opens it, focus returns to the title on close.
  - Checked at 375px in light and dark mode, with no sideways scroll; `noindex` in the page source.

**Spec: activity type pages**

- The chip list moves from `SearchControls` to `src/models/activities.ts`, each with a `slug`, the search `q`, a label, an H1 ("Drop-in swimming in Mississauga"), a meta description and a one-line intro. Slugs: `pickleball`, `swim`, `yoga`, `skate`, `hockey`, `basketball`, `badminton`, `volleyball`, `table-tennis`, `soccer`.
- `src/app/[activity]/page.tsx`: one prerendered page per slug (`generateStaticParams`). `dynamicParams = false` isn't allowed with Cache Components, so any other slug calls `notFound()`: the not-found page with `noindex`, but status 200, like `/activity/{id}`, because the static shell is sent before the slug is checked. The slug is read inside `<Suspense>` so navigation stays instant; the listed slugs still have their H1 in the static HTML. H1 and intro, then the usual search view with the activity's search filled in. Its own title, description, canonical (`/swim`) and OG title.
- `SearchView` takes optional `defaults` that fill only fields the URL leaves empty. Every control still links to `/`, so the first filter change moves to the main list. The search box goes to its form's `action` (`/`), not the current path, and keeps focus across that page change.
- Chips link to their activity page (keeping other active filters), so the home page links to every one; the active chip links back to `/`. The details popup's "More {activity} sessions" links to the activity page.
- `sitemap.xml` becomes `src/app/sitemap.ts`, listing `/`, the activity pages and, once built, the centre pages.
- **Acceptance (done):** unit: unique slugs, `defaults` fill only empty fields. e2e: `/swim` shows its H1, title, canonical and only swim sessions; typing a search there moves to `/?q=` with focus kept; a chip links to its page keeping filters, and toggles back; unknown slugs (`/frisbee`, `/calendar`, `/centres`) show the not-found page with `noindex`; the sitemap lists the pages. Lighthouse on `/swim` still to check after deploy.

**Spec: centre pages and Browse links**

- `src/app/centres/[slug]/page.tsx`: the slug is the centre's name in URL form (`churchill-meadows-community-centre`), from `ALL_CENTRES`; one static route per centre, others 404. H1 the centre's name; its address, phone and a map link from `getActivityInfo` of its first upcoming session (no new data file; left out if there's none), then the search view filtered to that centre. Own title, description and canonical; listed in the sitemap.
- A **Browse** section at the bottom of the home page with two short link lists, "By activity" and "By centre", for people and crawlers. A card's centre name still adds that centre to the filter.
- **Acceptance:** e2e: a centre page shows its name, address and only its sessions; `/centres/290` (an id, not a slug) is a 404 (`/centres/290` already is; `/centres` alone is now the activity not-found page); the Browse links work. Lighthouse as above.

**Later:** favourites, an `.ics` calendar export, a PWA, "notify me when spots open", activity detail pages as SEO pages (left out for now: thin, and they change every season), and fees if the City ever publishes them online.

## Verification

- `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build` pass (CI's `check` job runs all of them, Prettier included).
- `npm run e2e` passes: Playwright (Chromium, 375px phone and desktop) against a production build and a mock of the City API (`e2e/mock-activenet.mjs`). It covers sideways scrolling, chips, search, the filter sheet, spots, Full, Enroll now, refresh, card taps and centre links, search-as-you-type, collapsible days, share links, the header's GitHub and coffee links, security headers, and links to other sites opening a new tab. CI runs it in `.github/workflows/playwright.yml` with 3 workers (GitHub's runners have 4 cores). Tests tagged `@any-size` (ones that behave the same at every size: share links, search box, spots, headers, keyboard) run on desktop only. Tests wait for hydration before tapping anything a script handles, or a tap lands on plain HTML.
- `npm run capture-fixtures` gets live data for calendars 1 and 3.
- **Manual checks in `npm run dev`** (Chrome devtools, iPhone SE width of 375px):
  - Searching "pickleball" shows Enroll online rows. Each has a time and centre you can read at a glance, a spots-left count with "as of", and an Enroll button that opens the right ActiveMississauga enroll page.
  - A full session shows "Full" with no Enroll button, while other sessions of the same activity still show their own counts.
  - The refresh button updates the count.
  - Drop-in rows have no Enroll button.
- Lighthouse mobile: accessibility, best practices and SEO stay at 100, and performance at 90 or above (Lighthouse CI runs on each Vercel preview).
