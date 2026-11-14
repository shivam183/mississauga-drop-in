# Mississauga Drop-In

An unofficial, mobile-friendly way to find drop-in and online-enrollable
recreation programs in Mississauga: badminton, pickleball, swimming, skating and
more. See **when** and **where** at a glance, how many **spots are left**, and
tap straight through to enrol on the City's site.

> **Not affiliated with the City of Mississauga.** This project reads the same
> public schedule data shown on ActiveMississauga and always links back to it.
> Registration and payment happen only on the City's site. Schedules can change;
> check with the City before you go.

**Live:** https://mississauga-drop-in.vercel.app · **Status:** working towards
v0.1. See the [plan](docs/PLAN.md).

## Features

- One list of drop-in sessions and online-enrollable programs, grouped by day.
- Time and community centre shown first on every result.
- Search as you type; filter by type, one or more centres, day and time of day.
- Spots left per session, with an **Enrol now** button that opens the City's
  enrolment page.
- Built for phones first; works without JavaScript except for live spot counts.
- A public JSON API: see below.

## Public API

The schedule is also available as JSON, free and without a key:
`/api/centres`, `/api/sessions` (with the same filters as the site) and
`/api/availability` (spots left). See [docs/api.md](docs/api.md).

## Quick start

Requires Node.js 22 or newer.

```bash
git clone <this-repo-url>
cd mississauga-drop-in
npm install
npm run dev
```

Then open http://localhost:3000.

| Command             | What it does                                           |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | Start the dev server                                   |
| `npm run build`     | Production build                                       |
| `npm test`          | Run unit tests (Vitest)                                |
| `npm run e2e`       | End-to-end tests (Playwright, against a mock City API) |
| `npm run lint`      | Lint with ESLint                                       |
| `npm run typecheck` | Type-check with TypeScript                             |
| `npm run format`    | Format with Prettier                                   |

## How the data is fetched

The server calls the public JSON endpoints behind the City's ActiveNet online
calendar. No login or API key is involved, the browser never calls the City
directly, and requests are cached and throttled to keep the load on the City's
servers low. Details are in [docs/data-source.md](docs/data-source.md).

## Project layout

```
docs/         plan, architecture, data source and API docs
src/app/      pages and API routes (Next.js App Router)
src/components/  UI components
src/lib/      services: ActiveNet client, caching, URL params
src/models/   pure data types and functions
scripts/      fixture capture, centre-list update, API health check
tests/        unit tests and recorded API fixtures
e2e/          Playwright tests and the mock City API
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[code of conduct](CODE_OF_CONDUCT.md). To report a security problem, see
[SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE)
