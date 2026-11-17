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
  - Search engines (2026-11-17): static `robots.txt` (crawl everything but `/api/`) and `sitemap.xml` (just `/`) in `src/app/`, and a canonical URL of `/` so filter URLs aren't indexed as separate pages. The apex domain is canonical, so it must be the primary domain in Vercel (it redirected to `www.` before). Site verified and sitemap submitted in Google Search Console (done by hand).
  - Logo (2026-11-17): a grey map pin with a red ring at its base and, in a white disc, a red Mississauga skyline (City Hall's clock spire and the two Absolute World towers); drawn for this site, not stock art. In `src/app/icon.svg` (tab and Google result icon) and `src/app/apple-icon.png` (180px, iOS home screen); also shown beside the site name in the header. Replaces the default Next.js `favicon.ico`.
  - Share card and site name (2026-11-17): `src/app/opengraph-image.tsx` builds a 1200×630 card (logo, name, one-line pitch) at build time, used for Open Graph and as a large X/Twitter card. The home page carries `WebSite` JSON-LD so Google shows "Mississauga Drop-In" as the site name. Bing Webmaster Tools imported from Search Console (done by hand).
  - Buy Me a Coffee (2026-11-17): Buy Me a Coffee's own cup logo (self-hosted as `public/bmc-logo.svg`, on a circle in their yellow so it shows on the dark theme) right of the GitHub icon in the header; every header logo has a hover tooltip (`title`) and a "Support" section in the README, both linking to https://buymeacoffee.com/shivam183. A plain link, not BMC's widget script, so the CSP, speed and privacy stay as they are.
  - Done: the `RELEASE_PLEASE_TOKEN` secret (a fine-grained PAT) is set, so release PRs get their checks. Renew it before it expires.

**6. Find it faster** (in progress)

Goal: get a regular user from opening the site to the session they want in as few taps as possible, without accounts and without new data from the City.

- ✅ **Activity chips** (#35): a row of one-tap chips (Pickleball, Swim, Yoga, Skate…) that set the search. Type moved into the filter sheet.
- ✅ **"On now" and "Starts in N min" labels** (#36). See the result card section.
- ✅ **Share button and session links** (#38, #39). See the result card section. `/api/sessions` accepts the same `session` parameter (`docs/api.md`).
- ✅ **Fix:** opening the filter sheet on a phone no longer pops up the keyboard; the sheet focuses itself, not its first field (#41).
- ❌ **"My centres" chip** (#40, closed): remembering the last centres in the browser and offering them as a chip. Decided it isn't worth adding.
- ⬜ **Collapsible day sections.** Spec below.
- ❌ **Week strip and header day menu** (2026-11-16, compared in an interactive mock): a row of day chips adds clutter to the home page, and chips are for activities only; a menu on the sticky day header is easy to miss and not a common pattern. Jumping to a specific day stays in the filter sheet's day picker.
- ⬜ **Age group and price on the card.** Investigate first: check whether the City's events or detail responses include an age range or a fee. Write a spec only if they do; otherwise drop both.

**Spec: collapsible day sections**

Unfiltered, one weekday has 220–250 sessions (weekends about 100; live schedule, 2026-11-16), so the first page of 30 is all Today. Each day's sticky heading ("Today · Mon Nov 16") stays on screen while you scroll through it. Tapping a heading collapses that day, and the page refills with the next sessions, so there's always something below.

- **What:** each day group becomes a native `<details open>` with the heading inside its `<summary>` (the `<h2>` stays, for heading navigation). A chevron after the heading shows the state: pointing down when open, right when collapsed.
- **Behaviour:**
  - Every day starts open. Tapping or pressing Enter/Space on a heading collapses or opens that day only.
  - **Collapsed days don't count toward the page.** The page still shows up to 30 sessions (more after "Show more"), taken from the open days only. Collapsing Today brings in Tomorrow's first sessions; collapsing Tomorrow brings in the next day's, and so on.
  - A collapsed day keeps its heading in the list (headings appear for collapsed days up to the last session shown), so you can see it's there and open it again. Opening it brings its sessions back at the top, and the page keeps its size, so later sessions move below "Show more". Until they arrive, the reopened day shows two placeholder cards (the same skeleton as the first page load, sent hidden inside every collapsed day), not a blank space.
  - Pages stay at 30 sessions, not whole days: a whole weekday is too many cards for a phone (50 per page already cost Lighthouse points; see Phase 3). A heading can cover part of a day, as it does today, and "Show more" continues it.
  - **The next day is already started.** When every card on the page belongs to one open day, the page also shows the first 5 sessions of the next open day (so up to 35 cards). Collapsing that day reveals those cards at once, while the refill loads in the background. Found while testing: without it, collapsing Today left a blank screen until the server answered (about 0.8 s on the dev server).
  - Collapsing a day from its stuck heading keeps that heading on screen, with the next day directly below it. The page holds its height from the tap until the refill navigation finishes; otherwise the shorter page makes the browser jump to the top, which was very visible on desktop (scroll position 1500 to 156).
  - **State lives in the URL:** `collapsed=2026-11-16,2026-11-17` (valid dates only, at most 14). "Show more" keeps it. A new search or filter change drops it, like `session`, so new results are never hidden. Nothing is stored in the browser.
- **How it loads:** the collapse happens instantly in the browser. The client then replaces the URL without scrolling (`router.replace`, `scroll: false`), and the server renders the refilled page, the same path as "Show more". A pure function picks the page (the first `limit` sessions, skipping collapsed days) and is unit-tested.
- **Without JavaScript:** the native element still collapses and opens days, but the page doesn't refill.
- **Accessibility:** the summary is focusable and announces expanded/collapsed natively; the focus ring is visible; the whole heading row is a tap target of at least 44px.
- **Cost (checked 2026-11-16):** each collapse is one page request, the same as tapping "Show more". No new cache entries: the schedule is one entry whatever the URL, so a warm server reads it from memory and a cold one makes one remote read. No extra requests to the City. Spots lookups stay the same or drop, since collapsed days' cards stop asking. A 60-card page response is 12.7 KB gzipped and took 0.43 s. While the Runtime Cache is paused, a cold server can take 3–6 s to refill; the collapse itself is still instant.
- **Acceptance:**
  - Unit: page selection with no collapsed days (unchanged from today), with collapsed days skipped, with every day collapsed, and with `limit` above 30. A one-day page also shows the next open day's first 5 sessions, skipping collapsed days in between; a page with two or more open days doesn't. `collapsed` parsing rejects bad dates and caps the list.
  - e2e at 375px: collapsing a heading hides that day's cards, keeps its heading, and refills the page with the next sessions; opening it brings them back; other days are unaffected.
  - e2e (phone and desktop): collapsing a heading while it's stuck leaves that heading at the top of the screen, without jumping to the top of the page, and the next day's cards are visible right away.
  - e2e: after "Show more", a collapsed day is still collapsed; after a new search, every day is open.
  - e2e: keyboard, Tab to a heading and press Enter to toggle.
  - Checked in a browser at phone width in light and dark mode, with no sideways scroll.

**Later:** favourites, an `.ics` calendar export, a PWA, and "notify me when spots open".

## Verification

- `npm run lint && npm run typecheck && npm test && npm run build` pass.
- `npm run e2e` passes: Playwright (Chromium, 375px phone and desktop) against a production build and a mock of the City API (`e2e/mock-activenet.mjs`). It covers sideways scrolling, chips, search, the filter sheet, spots, Full, Enroll now, refresh, card taps and centre links, search-as-you-type and Enroll now opening a new tab. CI runs it in `.github/workflows/playwright.yml`.
- `npm run capture-fixtures` gets live data for calendars 1 and 3.
- **Manual checks in `npm run dev`** (Chrome devtools, iPhone SE width of 375px):
  - Searching "pickleball" shows Enroll online rows. Each has a time and centre you can read at a glance, a spots-left count with "as of", and an Enroll button that opens the right ActiveMississauga enroll page.
  - A full session shows "Full" with no Enroll button, while other sessions of the same activity still show their own counts.
  - The refresh button updates the count.
  - Drop-in rows have no Enroll button.
- Lighthouse mobile accessibility and performance scores are both at least 90.
