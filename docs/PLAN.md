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
- **Closed:** any other notice with no `href`, such as "this activity is over". There is no button, and the notice is shown as plain text. One exception: "this activity is over" (the session has started) while at least 1 spot is still open is replaced by a hint to call the centre (its own number as a `tel:` link inside the sentence) or ask at the front desk about walking in. There is no "Details" link there, so the phone number isn't next to another link, since the City's wording puts people off trying.
- **Unknown:** the lookup failed. Show "Check on ActiveMississauga" and link to `activity_detail_url`.

**Centre phone numbers:** the API's `detail.centers[0].phone` is (905) 615-4100, the City's general line, for every centre. Each centre's own front-desk number is kept by hand in `src/models/phones.ts`, keyed by `centers[0].id`, from the centre's page at mississauga.ca/recreation-and-sports/locations/ (checked 2026-11-26). Centres missing from that list fall back to the API's number. The details popup, the centre pages and the walk-in hint all use this number.

Only https `*.activecommunities.com` URLs are allowed as links. The notice HTML is turned into plain text and never rendered as markup.

Answered in Phase 1 (see `docs/data-source.md`):

- **Date range:** `search_start_time` and `search_end_time` are ignored in every format tried. The API always returns its whole window (the Monday of this week to about 6–8 weeks ahead), so the app filters by date itself.
- **Centres per request:** any number, with no paging. But calendar 1 with all 21 centres is about **12 MB**, so requests are batched (about 5 centres each), and the cache stores normalised sessions, not raw responses.
- **Calendar 3 shape:** the same as calendar 1. On 2026-11-14 it held only "Drop In Adult Pickleball" (about 480 sessions at 10 centres).
- **Spots for one session:** in calendar 3, **every session has its own `event_item_id`**, so `/activity/detail/{event_item_id}` is already per session, and counts are cached by `event_item_id`. No `selected_date` is needed for detail.

## Tech stack

- **Next.js (App Router) + TypeScript + React**, rendered on the server and styled with CSS modules.
- **Caching:** this Next.js version uses Cache Components (`cacheComponents: true`), so caching uses `"use cache"` with `cacheLife` in the `src/lib/` services, not `fetch` revalidate options. The ActiveNet client itself never caches. The merged schedule is cached until 7 am Toronto time each day (one cache write a day; the centre batches aren't cached separately), button status (enroll link, opening time) for 10 minutes, and spot counts for 60 seconds. The refresh button bypasses the cache with `?fresh=1`, rate-limited per IP.
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

**Runtime Cache writes, 2026-11-17:** 75% of the 200,000 monthly writes were used. The schedule was written every 10 minutes, twice over (each centre batch and the merged list). Now only the merged list is cached and it refreshes daily at 7 am, so it's written about once a day. Moving the cache to Redis was considered and not needed: with a daily refresh the writes are tiny, and Redis would add a service with its own limits.

**Memory cache lifetimes, 2026-11-19:** a `"use cache"` wrapper without its own `cacheLife` uses Next's 15-minute default (a longer inner lifetime doesn't carry over; see `cacheLife.md`, "Nested caching behavior"). So each warm instance re-read the schedule (the big item) and the activity details from the Runtime Cache about every 15 minutes instead of daily. Every memory layer now sets its lifetime explicitly: the schedule the same 7 am / one-minute-after-a-failure rule as its remote copy, activity details and the registered lists `info` (daily).

**Fluid Active CPU, 2026-11-18:** 90% of the free 4 hours a month was used in about four days, with only about 850 page views. If it runs out, Vercel pauses the project until the period resets (about 2026-12-14).

- **Cause:** OpenAI's GPTBot (the top user agent in Firewall). Every page renders per request (about 150–270 ms of CPU each, measured on a local production build), and the site links to endless combinations: `/?q=…&centre=…` for every activity and centre, and `/activity/{id}?session=…` for every session, new each day. Web Analytics doesn't count crawlers, so the traffic didn't show there.
- **Fixes:** Vercel Firewall → Bot Management → AI Bots: Deny (instant; blocked requests run no function). `robots.txt` blocks GPTBot entirely and, for every crawler, query strings and the noindex details pages (`/activity/`, `/registered/`). OAI-SearchBot (ChatGPT search) and search engines still reach `/`, the activity pages and the centre pages.
- **Lessons:** before adding crawlable pages (such as registered programs, about 9,600 details pages and their filters), check that crawlers can't fan out over them; watch Vercel → Usage → Fluid Active CPU after deploys. Hold the registered-programs deploy until the CPU period resets.

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
│ 7 – 9 PM                [Enroll online]│  ← time: largest text
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
- Times are always shown in Toronto time with am/pm, without ":00" on the hour ("7 – 9 PM", "10 AM – 12:30 PM"): a range that crosses noon with ":00"s, like "10:00 AM – 12:00 PM", wrapped under the badge on a 390px phone.
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
  - Done: `v1.0.0`, the project is feature complete. Forced with a `Release-As: 1.0.0` footer on the squash commit (the PR body), since `bump-minor-pre-major` keeps 0.x from reaching 1.0 on its own.

**6. Find it faster** ✅

Goal: get a regular user from opening the site to the session they want in as few taps as possible, without accounts and without new data from the City.

- ✅ **Activity chips** (#35): a row of one-tap chips (Pickleball, Swim, Yoga, Skate…) that set the search. Type moved into the filter sheet.
- ✅ **"On now" and "Starts in N min" labels** (#36). See the result card section.
- ✅ **Share button and session links** (#38, #39). See the result card section. `/api/sessions` accepts the same `session` parameter (`docs/api.md`).
- ✅ **Fix:** opening the filter sheet on a phone no longer pops up the keyboard; the sheet focuses itself, not its first field (#41).
- ✅ **Fix:** the search box's ✕ clears the search without focusing the box, so it doesn't pop up the keyboard on phones.
- ❌ **"My centres" chip** (#40, closed): remembering the last centres in the browser and offering them as a chip. Decided it isn't worth adding.
- ✅ **Collapsible day sections** (#48). Summary below.
- ❌ **Week strip and header day menu** (2026-11-16, compared in an interactive mock): a row of day chips adds clutter to the home page, and chips are for activities only; a menu on the sticky day header is easy to miss and not a common pattern. Jumping to a specific day stays in the filter sheet's day picker.
- ✅ **Age group and price on the card: investigated** (2026-11-17). Ages (`age_description`, e.g. "16 yrs +") are only in `/activity/detail`, per activity, not in the events list, so showing them on every card would cost a City call per card. They go in the details popup instead (Phase 7). Fees aren't published online for drop-ins (`/activity/detail/estimateprice/{id}` returns `show_price_info_online: false` and no prices), so price is dropped. (Registered programs do publish fees; see **Spec: registered programs**.)

**Collapsible day sections (done, #48).** Each day is a native `<details open>` whose sticky heading collapses or opens that day. Collapsed days don't count toward the 30-session page, so the page refills with the next sessions; their headings stay so they can be reopened. State lives in the URL (`collapsed=` dates, at most 14), survives "Show more" and is dropped by any new search. When the page is all one day, the next open day's first 5 sessions are already shown, so a collapse never leaves a blank screen; the page keeps its scroll position. Without JavaScript the days still collapse but don't refill. Covered by unit tests (page selection, `collapsed` parsing) and e2e (refill, stuck heading, keyboard, "Show more").

**7. Get found** (in progress)

Goal: people searching Google for a drop-in in Mississauga land on a page that matches their search, and can see what a program is without leaving the site.

Done (2026-11-17):

- ✅ **Search engines** (#50): static `robots.txt` (crawl everything but `/api/`) and `sitemap.xml` in `src/app/`, and a canonical URL of `/` so filter URLs aren't indexed as separate pages. The apex domain is canonical and is the primary domain in Vercel (`www.` redirects to it). Verified in Google Search Console, sitemap submitted; Bing Webmaster Tools imported from Search Console (done by hand).
- ✅ **Logo** (#51): a grey map pin with a red ring at its base and, in a white disc, a red Mississauga skyline (City Hall's clock spire and the two Absolute World towers); drawn for this site, not stock art. `src/app/icon.svg` (tab and Google result icon), `src/app/favicon.ico` (16/32/48px, rendered from the SVG; Google asks for `/favicon.ico` directly, which returned the home page as HTML until it existed, so results kept showing the old Next.js icon), `src/app/apple-icon.png` (180px, iOS home screen), and beside the site name in the header.
- ✅ **Share card and site name** (#52): `src/app/opengraph-image.tsx` builds a 1200×630 card at build time, used for Open Graph and as a large X card. The home page carries `WebSite` JSON-LD so Google shows "Mississauga Drop-In" as the site name.
- ✅ **Buy Me a Coffee** (#53): BMC's own cup logo (self-hosted `public/bmc-logo.svg`, on a circle in their yellow) right of the GitHub icon, with hover tooltips on every header logo; in the README, a logo, badges, a "Find a drop-in" button and BMC's button. A plain link, not BMC's widget script, so the CSP, speed and privacy are unchanged.
- ✅ **Sticky header**: the site header stays at the top; day headings and the desktop filter panel stick just under it (`--header-h` in `globals.css`), and `scroll-padding-top` keeps jumps (like collapsing a day from its stuck heading) below it too.
- ✅ **Coffee nudge**: the header link is a yellow "Buy me a coffee" pill with the cup (just the cup in a circle under 480px wide, so the header stays one row). On each full page load it bounces three times, and as soon as the page is interactive a bubble under it shows one of five messages, picked at random per load ("Finding this useful? ☕", "Saved you a trip? ☕", …; on phones, where the link is just the cup, "… Buy me a coffee ☕"), for three seconds and shrinks all the way back into the cup (to `scale(0)`, not halfway and then gone), or does so at once at the first scroll. It scales rather than fades: half-transparent text fails contrast checks (Lighthouse caught it mid-fade). The animation is CSS; `src/components/CoffeeNudge.tsx` only picks the text, after hydration, and listens for that first scroll. It sits beside the link in a shared wrapper, not inside it, so the link's visible text matches its name (Lighthouse's label-content-name check); clicks pass through it to the page, it's hidden from screen readers (the link's label already says it), and there's no bounce under reduced motion.
- ✅ **Back to top**: on the list pages (`SearchView`), a round button at the bottom right appears once you've scrolled 400px (past the search box and chips) and scrolls to the top (smoothly, or instantly under reduced motion), then moves focus to `<main>` so keyboard users aren't left on a hidden button. `src/components/ScrollTopButton.tsx`.

To do, in this order (batch the code PRs into few deploys: each deploy empties the Runtime Cache, which is paused until about 2026-12-14; see **Hosting limits**):

- ✅ **Activity details popup and page.** Spec below.
- ✅ **Activity type pages** (`/swim`, `/pickleball`, …). Spec below.
- ✅ **Centre pages and Browse links** (`/centres/{slug}`). Spec below.
- ✅ **Drop-in filters and links:** the filters in use show as **pills** above the results (type, date, times, centres; not the search text and chips, nor what a centre page sets itself), each removing its filter (`FilterPills`, shared with `/registered`), the same size as the chips. The filter form **follows the URL**: it remembers the queries it applied itself, and any other change (Clear filters, a chip, a pill, a card's centre link) remounts its fields with the new values, so they never show stale choices. Text links use a thin, soft underline set below the letters, solid on hover.
- ✅ **Registered programs** (`/registered`, a Drop-in | Registered toggle in the header). Spec below. Ship after the Runtime Cache unpauses (about 2026-12-14).
- ✅ **Fix:** on desktop, a search with no results no longer pushes the chips and the "No upcoming sessions" message down the page. The sidebar spans the search, chips and results rows; when it was taller than them, the spare height went to every row. Now only the results row grows (`grid-template-rows: auto auto 1fr`), on `/` and `/registered`.
- ✅ **Colour and icons**: Mississauga red from the logo (`--brand`, lighter in dark mode) as a 3px stripe along the top of the header (an inset shadow, so `--header-h` is unchanged) and as the Drop-in | Registered toggle pill. **Emoji icons**, like the 📍 before the centre and hidden from screen readers (the name is always beside them): each drop-in chip has one (`icon` in `src/models/activities.ts`: 🎾 pickleball, since there is no pickleball emoji, 🏊 🧘 ⛸️ 🏒 🏀 🏸 🏐 🏓 ⚽), and so does each registered chip (🏊 🏕️ 🏀 💪 ⛸️ 💃 🎨 🏆 📚, in `RegisteredView`). Drop-in and registered cards, and the details popup and page (its instant preview too), show one before the title from `iconFor(title)`: the matching chip's, else a keyword list matched at the start of a word (aquafit and therapeutic swims 🏊, cycle 🚴, meditation and mind–body 🧘, fitness classes like Low and Tone, Total Body Toning and Stronger and Steadier 💪, camps, card games, bowling, play and youth drop-ins, music, dance, drama, art, billiards, chess, martial arts, cooking), else none. The list came from the live drop-in titles: all but one of 197 get an icon. A coloured band per activity along the top of each card was tried and dropped: it clashed with the spots stripe on the left edge.
- ✅ **Add to calendar**: a third round button (calendar icon) beside Directions and Call in the details popup and page (`WhereRow`, `CalendarLink`). Only there, not on the cards: #93 put an icon at the end of each card's 📍 line, but unlabelled beside Share (and refresh on enroll cards) it cluttered the card, and people add a session to their calendar once they've decided to go, usually from the details. Drop-ins and enroll-online sessions: `/activity/{id}/calendar?session={id}` gives that one session. Registered programs: `/registered/{id}/calendar` gives each meeting pattern as a weekly event (`RRULE` with `BYDAY` and `UNTIL`), skipping the City's exception dates (`EXDATE`; "25 Dec 2026" or grouped "24,30,31 Dec 2026"), plus each extra one-off date; no button when the City gives no pattern we can read (`calendarPatterns`, from the same meeting-dates call the popup already makes, so no extra City request). Files are `text/calendar` attachments in Toronto time with a Toronto `VTIMEZONE`, so weekly classes keep their clock time across DST; `src/models/calendar.ts` writes them (escaping, 75-byte folding). Each event's notes give the City's page ("Details and registration"), its page here ("Found on mississaugadropin.com") and the Buy Me a Coffee link (`src/lib/site.ts` holds the site and coffee URLs, shared with the header and sitemap). Plain links, no JavaScript: phones offer to add the event, computers download it.
- ✅ **Remind me**: while online enrollment is still to open, the greyed-out box reads "Opens Nov 24, 7 AM" with a "Remind me" outline button (a small alarm-clock icon) beside it, on one row down to 360px wide: a short date (`formatShortDateTime`, "Nov 24, 7 AM", with a non-breaking space in "7 AM"), 15px text and tighter padding (`EnrollButton`, so on registered cards and popups and on enroll-online cards and popups alike). It links to `/registered/{id}/reminder` or `/activity/{id}/reminder`: a 15-minute event at the opening time, titled "Registration opens: …", with an alert 10 minutes before (`VALARM`) and the enroll link as the event's link and in its notes (`reminderEvent`). Not found once enrollment has opened. Drop-in sessions use the live enroll state (`getAvailability`); programs use the program's.
- ✅ **Fix:** `/registered` has a visually hidden "Programs" H2 above the list. Its cards are H3s, and on phones (filter sheet closed) nothing came between them and the H1, so Lighthouse flagged the heading order (mobile accessibility 98).
- ⬜ **By hand after launch:** resubmit the sitemap in Search Console and Bing; about 2–3 weeks later, check Search Console → Performance for the queries people use and pick any further landing pages from them.

**Spec: activity details popup and page**

Tapping a card's title opens a popup over the list with what the City's activity page shows; opening the same URL directly (shared link, refresh, no JavaScript) shows it as a full page.

- **Data:** `GET /activity/detail/{id}`, already called for spots, also has `catalog_description`, `age_description` ("16 yrs +,"), `allowed_gender`, `category`/`sub_category`, `season_name`, `first_date`/`last_date`, `online_notes` (HTML) / `user_notes`, `facilities[].name` and `centers[]` (address, postal code, phone, latitude/longitude). No fees for drop-ins (see Phase 6).
- **Model:** `src/models/activity.ts` turns the raw detail into a small plain `ActivityInfo`: name (`displayTitle`), category, ages (trailing comma removed), gender (only if not "Mixed"), season and dates, description, notes (`noticeToText`, never rendered as HTML), rooms (`roomName`) and the centre's address, phone and coordinates. Every field is optional and read defensively; `assertActivityDetailBody` doesn't change.
- **Service:** `src/lib/activity.ts` `getActivity(id)`, cached per request with React `cache` (the page's metadata and body share it). It reads that activity's sessions from a small per-activity in-memory cache of the schedule, then the City's details: drop-ins through a new `info` cache (memory then Runtime Cache, revalidate 1 day, expire 7 days, only the small `ActivityInfo`, about 1–2 KB); enroll sessions from the spots lookup's cached detail (60 s), which their popup needs anyway, so it's one City call. Only ids of upcoming sessions are looked up; anything else gets the not-found page, so the route can't be used to query the City for arbitrary ids.
- **Content** (agreed in an HTML mockup, 2026-11-17), top to bottom:
  - Drop-in/Enroll badge and ✕; the name; fact chips: category, ages, and season with dates. The **ages chip is highlighted** (accent tint, bold, 👤 icon) and gets **one sweep of shine** about 0.3 s after opening, never looped and skipped under `prefers-reduced-motion`.
  - **The tapped session:** date and time, with "On now" / "Starts in N min" on its own line under it (beside the time it wrapped unevenly on phones), centre · room, with two small icon buttons beside the centre: **Directions** (a "Directions in" dropdown under the button with a pointer at it, a native `popover` placed by `MapsMenu` (above the button when there is no room below; closes on scroll): Google Maps and Apple Maps by the centre's name and address, so they find its listing, and Waze by coordinates; the last app picked is listed first, remembered in this browser's `localStorage` only) and **Call** (`tel:`), each at least 40px with an accessible name. For enroll sessions, spots left with "as of" and refresh (the existing `SpotsLeft`) sit inside this box.
  - **Upcoming** (drop-ins): the next 4 sessions of this activity, then a summary line: "Every Tuesday until Dec 29 · 9 sessions this season" when all sessions fall on one weekday, otherwise just the count (`other_info.sessions`).
  - **About:** the description. **Good to know:** the notes as plain text (for drop-ins, the City's "no registration, first come first served" note).
  - **No separate Where section** (removed 2026-11-18): the session box already has the centre with Directions (finds the centre by name and address) and Call, so the address and phone aren't repeated. The description and the City's age wording are decoded from HTML; ages read short ("Age at least 18 yrs but less than 100 yrs" → 18+, "4y 6m" → 4½) with one formatter shared with the registered cards.
  - **See more** (popup and full page): "More {activity} →" and "More at {centre} →", linking to the filtered list until the activity and centre pages exist, then to those pages. From the popup, following one closes it and shows that list.
  - **A bar pinned to the bottom** (popup and full page alike), so the main action never needs scrolling: for enroll sessions the existing `EnrollButton` (Enroll now / Opens {time}, disabled / Full) with "View on ActiveMississauga" under it; for drop-ins just "View on ActiveMississauga". Enroll appears only here, not twice. Scrolled to the end, the last content keeps a 24px gap above the bar.
  - Missing fields are left out. A **Share** button in the top row (beside the ✕ on desktop) shares the details page link, `/activity/{id}?session=…`, with the name, time and centre; whoever opens it gets the full details page. The card keeps its own Share (a link to the list showing that session).
- **Routes:** `src/app/activity/[id]/page.tsx` is the full page (title "{name} at {centre}", description, `noindex, follow`, not in the sitemap). The popup is the same content through Next's intercepting and parallel routes (`src/app/@modal/(.)activity/[id]`, `@modal/default.tsx`, the `modal` slot in the root layout).
- **Popup:** a native `<dialog>` (`showModal()`, the dialog itself takes focus, Esc closes, labelled by the name; focus returns to the tapped card). Backdrop tap, Esc and Back all go back. A bottom sheet on phones, that pulls down to close, like a native sheet: from the handle or anywhere on the head row (not its buttons), and from the content when it's scrolled to the top (touch events there, since the browser cancels pointer events once it scrolls; scrolled down, or starting upward, the swipe scrolls). Shared with the filter sheet (`useSwipeToClose`), which closes the same way: from its handle and title, or from the form when it is scrolled to the top (a scrolled list inside, like the centre picker, scrolls instead); **no ✕**; centred on desktop **with a ✕** (no handle there). Light and dark. **Full page:** the same top row, with ✕ as a plain link to `/` (it works without JavaScript and when there's no history to go back to), so it looks like the popup opened full screen. **Refresh vs shared link:** opening a card remembers, in this tab's `sessionStorage`, the popup's address, the list it came from (with filters) and its scroll position. A reload (or Back/Forward) of that address in the same tab, told apart by the page's navigation type, goes back to that list, scrolled to where it was, with the popup open over it (the stand-in covers the swap). A shared link (another tab or device) has no such memory and stays the full page. With storage blocked, a refresh just shows the full page.
- **Card:** the title links to `/activity/{id}?session=…` with `prefetch={false}` and `scroll={false}`. Tapping opens a **stand-in popup at once** in the browser with what the card already shows (name, badge, time, place) and placeholders; the real popup takes over in the same layout when the server answers. No prefetch, so cards on screen cost nothing until tapped. One spots store (`AvailabilityProvider` in the root layout) serves the list and the popup, so an enroll popup reuses the card's count.
- **Cost:** one City request per activity per day, only when a popup or page is opened (through the existing throttle). A calendar 3 session is its own activity, so its page shows one session and 404s once it has ended. If crawlers following card links show up in the logs, add `rel="nofollow"` to the title links.
- **Acceptance:**
  - Unit: `toActivityInfo` against `detail.1.json`, `detail.3.open.json` and `detail.3.full.json` (ages trimmed, "Mixed" hidden, HTML stripped from notes, no centre); `getActivityInfo` rejects ids that aren't upcoming sessions.
  - e2e (phone and desktop): tapping a card title opens the popup with name, description and address; Esc, Back and (desktop) the ✕ each close it and keep the scroll position; on phones, pulling down the handle, the head row, or the content at its top closes it (a tap on the head doesn't; scrolled down, a swipe scrolls), and there's no ✕; a refresh keeps the list (filters and scroll) with the popup over it, while a shared link in a new tab is the full page; it shows the card's name and time before the server answers; `/activity/{id}` loaded directly shows the full page; an unknown id shows the not-found page with `noindex` (the status is 200: the page shell is prerendered and streams before the lookup, and these pages aren't indexed anyway); an enroll session's popup and full page show spots, and Enroll is visible at 375px without scrolling; keyboard: Tab to the title, Enter opens it, focus returns to the title on close.
  - Checked at 375px in light and dark mode, with no sideways scroll; `noindex` in the page source.

**Spec: activity type pages**

- The chip list moves from `SearchControls` to `src/models/activities.ts`, each with a `slug`, the search `q`, a label, an H1 ("Drop-in swimming in Mississauga"), a meta description and a one-line intro. Slugs: `pickleball`, `swim`, `yoga`, `skate`, `hockey`, `basketball`, `badminton`, `volleyball`, `table-tennis`, `soccer`.
- `src/app/[activity]/page.tsx`: one prerendered page per slug (`generateStaticParams`). `dynamicParams = false` isn't allowed with Cache Components, so any other slug calls `notFound()`: the not-found page with `noindex`, but status 200, like `/activity/{id}`, because the static shell is sent before the slug is checked. The slug is read inside `<Suspense>` so navigation stays instant; the listed slugs still have their H1 in the static HTML. H1 and intro, then the usual search view with the activity's search filled in. Its own title, description, canonical (`/swim`) and OG title.
- `SearchView` takes optional `defaults` that fill only fields the URL leaves empty. Every control still links to `/`, so the first filter change moves to the main list. The search box goes to its form's `action` (`/`), not the current path, and keeps focus across that page change.
- Chips still filter in place (`/?q=swim`), not link to the activity page: tried in #59, but moving to another page swaps the whole view (skeleton, lost scroll) on every tap. The activity pages are for search engines and shared links: found through the sitemap, the details popup's "More {activity} sessions" link and, with the centre pages, the home page's Browse section.
- `sitemap.xml` becomes `src/app/sitemap.ts`, listing `/`, the activity pages and, once built, the centre pages.
- **Acceptance (done):** unit: unique slugs, `defaults` fill only empty fields. e2e: `/swim` shows its H1, title, canonical and only swim sessions; typing a search there moves to `/?q=` with focus kept; chips filter in place on `/`, keeping filters; unknown slugs (`/frisbee`, `/calendar`, `/centres`) show the not-found page with `noindex`; the sitemap lists the pages. Lighthouse on `/swim` still to check after deploy.

**Spec: centre pages and Browse links**

- `src/app/centres/[slug]/page.tsx`: the slug is the centre's name in URL form (`churchill-meadows-community-centre`), from `ALL_CENTRES`; one static route per centre, others 404. H1 the centre's name; its address, phone and a map link from `getActivityInfo` of its first upcoming session (no new data file; left out if there's none), then the search view filtered to that centre. Own title, description and canonical; listed in the sitemap.
- Switching centres stays in place, like the chips: the centre picker and a card's centre name filter `/` (`/?centre=…`), never link to a centre page, so there's no whole-page swap. The centre pages are for search engines and shared links: found through the sitemap, the Browse section and the details popup's "More at {centre}" link. On a centre page, `SearchView` gets the centre as `defaults`, so the first filter change moves to the main list, as on the activity pages.
- A **Browse** section at the bottom of the home page with two short link lists, "By activity" and "By centre", for people and crawlers. Both are rows with a › in a card, one column on phones and up to three on wide screens; not pills, since pills above the list filter in place and these go to another page.
- **Acceptance (done):** unit: unique, URL-safe slugs, `centreBySlug`, `centrePath`. e2e: a centre page shows its name, address and only its sessions; `/centres/290` (an id, not a slug) and unknown slugs show the not-found page; the popup's "More at" links to the centre page; the Browse links work; on `/`, picking a centre or tapping a card's centre name filters in place (URL stays `/?centre=…`). Lighthouse as above.

**Spec: registered programs**

Drop-ins answer "what can I go to today?"; registered programs (swimming lessons, camps, leagues, fitness and arts courses) answer "what can I sign up for this season?". They're kept apart: two areas, switched by a toggle in the header.

- **Data** (probed 2026-11-18; see `docs/data-source.md`): the City's activity search, `POST /activities/list`, the API behind ActiveMississauga's "Activity search" page. About 13,600 rows, of which about 4,000 are type "Drop In Program" (already on the Drop-in side), leaving **about 9,600 programs** (Swimming Lessons about 6,500, Sports 2,200, Fitness 1,200, …). Pages are capped at 20 rows, so copying everything would take about 480 requests; instead **each search goes to the City live**: every filter (keyword, centres, category, season, type, weekday, age, open spots) runs on their side, about 0.4 s per page. Fees come from `GET /activity/detail/estimateprice/{id}` (Resident / Non-resident; drop-ins publish none) and the meeting pattern from `GET /activity/detail/meetingandregistrationdates/{id}`.
- **Caching** (checked 2026-11-18 with a request-counting proxy in front of the mock):
  - **Search pages and program details (with fees): memory only** (`"use cache"`), 10 minutes (`enroll` profile), so spots stay close to live. Every filter combination is its own entry, too many to write to the Runtime Cache. Each page of 20 is its own entry, so "Show more" fetches only the new page. The keyword is sent in lower case (the City ignores case), so "Swim" and "swim" share an entry. Pages keep only the fields the card reads (about a fifth of the City's row).
  - **Filter lists and season info (count, earliest start, when its registration opens, from each season's first page sorted by start date): memory, then the Runtime Cache** (`"use cache"` around `"use cache: remote"`, like the activity details), a day (`info`). Each is small (one read unit) and changes at most each season; without the shared cache every cold instance would repeat them (about 16 City requests, all through the 2-per-second throttle).
  - **Nothing waits for what it doesn't need:** results need only the lists (one request); the Season filter's counts (one request per season, to leave out the many empty seasons the City lists) stream in their own `<Suspense>`, with a plain season list until then. Cold, with an empty cache: cards at 0.8 s, counts at 3 s. Warm: the same page makes no City requests.
  - **Failures are never cached** (they throw), so the next request tries the City again; a failed season count shows the seasons without counts instead of caching 0.
- **Model** `src/models/registered.ts`: `toProgram` (name, centre, days, time, dates, ages, status, enroll and City links through `safeCityUrl`), `programStatus`: **full** when the City says "Full" (even if `total_open` is above 0) or no spots; **opens** when `activity_online_start_time` is in the future (registration opens at 7 am on a set day); otherwise **open** with spots ("few" at 5 or fewer). "In progress" is shown as "Started". Also `toFees`, `meetingLines`, `agesLabel` ("At least 9 but less than 13" → "Ages 9–12"), the URL state and `toSearchPattern`, which always sends the non-drop-in types and a Sunday-first weekday mask; one age sets both `min_age` and `max_age`, which finds programs that suit that age.
- **Service** `src/lib/registered.ts`: `getProgramOptions`, `searchPrograms` (pages 1…N, each cached on its own), `getProgram` (details, enroll status, meeting times and fees together). A program's popup is refused (not-found page) for non-numeric ids, unknown ids, drop-in types and programs that have ended; every other id costs at most one throttled City lookup per 10 minutes, and the throttle (2 per second for the whole server) bounds what anyone can make us ask.
- **Page** `/registered` (`src/app/registered/page.tsx`, `RegisteredView`): H1 "Registered programs in Mississauga", the search box (as you type, like `/`), **chips** under it (Swim lessons, Camps, Sports, Fitness, Skating, Dance & music, Arts, Leagues, Learning: a City category found by name, or the keyword "camp"; one at a time, and Clear filters keeps it, like the drop-in chips; no Category menu, since chips and search cover it). Chips **work like the drop-in chips**: tapping one puts its word in the box ("sports", "swim lessons", "camp"), lights it, and replaces whatever was typed (kept together, "swim" + Sports found nothing and "tennis" + Sports looked unchanged). Behind the scenes a box holding just a category chip's word searches that City category (`chipSearch` and `PROGRAM_CHIPS` in `src/models/registered.ts`), since a word search finds far fewer (live 2026-11-26: Sports 476 vs "sport" 56, Fitness 239 vs 103, Arts 158 vs 66, Dance & music 128 vs 54, Learning 65 vs none); typing more makes it a normal word search. Camps stays a real word ("camp"), as camps span three categories. Old `?cat=` links still work and light their chip. A chip tapped while a typed search is still waiting (`SearchBox`, 300 ms) cancels it and the box takes the chip's search; before, the timer fired after the chip and replaced it, on `/` too, and filters in the same sheet/sidebar: Season (default **Upcoming seasons**: those with programs starting today or later, or started in the last 2 weeks, so in-progress seasons don't fill the list; then All seasons, then each season with its status and count, e.g. "2027 Winter · registration opens Nov 24 (4,704)"), Age (− [age] + stepper, 0–99, or type it; applied once taps or typing pause, so stepping to 6 is one search; adults use their own age), **Days** (Sun–Sat buttons, any of the days ticked; the City's day mask matches any marked day), Location (the existing centre picker over the search's 82 locations: centres, libraries, pools, parks) and "Has open spots". Filters live in the URL (`?q=&season=all|<id>&age=&cat=&day=tue,thu&centre=&open=1&pages=`; no `season` means upcoming). **The filters in use show as pills above the results** ("Age 6 ✕", "Tuesday ✕"…), each removing its filter; on phones the sheet is closed, so this is where they're visible. With the default, the count says "in upcoming seasons" and a line under it says "Programs already under way are hidden. Show all seasons". "Show more" adds a City page (20 rows), up to 10 pages, then asks to narrow the search. Sorted by start date. Canonical `/registered`, in the sitemap.
- **Card** (`RegisteredCard`, compact, on the session card's styles and stripes): days and time first, the days on one line and the time on the next ("Mon, Tue, Wed" / "9 AM – 4 PM", so a long day list doesn't wrap mid-time), with spots ("12 spots left" in green or amber, "Full" in red) and Share (a link to its details page) on the same row; **the dates right under the time** (they matter as much for a program), with "Started"; the name; the centre; ages ("Ages 4y 9m–14"); then the full-width `EnrollButton` at the bottom (Enroll now, or "Opens Nov 24, 7 AM" greyed out with Remind me beside it; none when full). No "Registered" badge (the tab says it) and **no price**: what you pay depends on residency and memberships, so fees are only in the popup, with a note saying so.
- **Popup and page** `/registered/{id}` (`RegisteredDetails`, the same `Modal`, stand-in and swipe-to-close as `/activity/{id}`, through `@modal/(.)registered/[id]`): "Registered" badge, name, facts (category, ages, season), when it meets (one line per pattern, with the number of classes), centre with Directions and Call, spots, **Fees** (Resident / Non-resident, and a note that what you pay depends on residency and memberships), About, Good to know, Where; the bottom bar has the existing `EnrollButton` (Enroll now / Opens … with Remind me / nothing when full) and "View on ActiveMississauga". `noindex`.
- **Header toggle** (`AreaTabs`): "Drop-in | Registered" between the logo and the GitHub and coffee links; the accent pill slides between the halves (at the tap, before the new page arrives; no slide under reduced motion). The site name text hides below 720px so the header stays one row down to 320px. The toggle reads the path, so it sits in `<Suspense>` with an un-highlighted fallback.
- **API** (`docs/api.md`): `GET /api/programs` takes the page's filters (`q`, `cat`, `season`, `age`, `day`, `centre`, `open`) plus `page` (1–10, 20 per page, like Show more; 400 otherwise) and returns `total`, a `next` link and each program's status (`open`, `full`, or `opens` with an ISO `opensAt`); shared caches keep it 60 s. `GET /api/programs/filters` lists the location, category and season ids (a day). `searchPrograms` takes a first page, so a page costs one City request, not all the pages before it.
- **Acceptance (done):** unit (`tests/unit/registered.test.ts`, recorded fixtures `activities.*.json`, `estimateprice.json`, `meetingdates.json`): shape checks, mapping (full despite openings, open/few/opens/started, unsafe links dropped), time and age labels, fees and free, meeting lines, URL parsing and links, the search pattern. e2e (the mock serves the recorded search: #0 open, #1 full, #2 opening tomorrow): the toggle switches areas with `aria-current`; on phones the header is one row; cards show when, spots, fee and Enroll; a search stays on `/registered`; a card opens its popup with fees and Enroll, Esc closes it; a program page loads directly, unknown ids are not found, both `noindex`.

**Later:** favourites, a PWA, "notify me when spots open", activity detail pages as SEO pages (left out for now: thin, and they change every season), and, from Search Console data, landing pages for program categories (`/registered/swimming-lessons`).

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
