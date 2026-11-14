# Mississauga Drop-In

An unofficial, mobile-friendly way to find drop-in and online-enrollable
recreation programs in Mississauga: badminton, pickleball, swimming, skating and
more. See **when** and **where** at a glance, how many **spots are left**, and
tap straight through to enrol on the City's site.

> **Not affiliated with the City of Mississauga.** This project reads the same
> public schedule data shown on ActiveMississauga and always links back to it.
> Registration and payment happen only on the City's site. Schedules can change;
> check with the City before you go.

**Status:** early development. See the [plan](docs/PLAN.md).

## Features (planned for v0.1)

- One list of drop-in sessions and online-enrollable programs, grouped by day.
- Time and community centre shown first on every result.
- Search by activity, filter by centre, date, time of day and type.
- Spots left per session, with an **Enrol now** button that opens the City's
  enrolment page.
- Built for phones first; works without JavaScript except for live spot counts.

## Quick start

Requires Node.js 22 or newer.

```bash
git clone <this-repo-url>
cd mississauga-drop-in
npm install
npm run dev
```

Then open http://localhost:3000.

| Command             | What it does               |
| ------------------- | -------------------------- |
| `npm run dev`       | Start the dev server       |
| `npm run build`     | Production build           |
| `npm test`          | Run unit tests (Vitest)    |
| `npm run lint`      | Lint with ESLint           |
| `npm run typecheck` | Type-check with TypeScript |
| `npm run format`    | Format with Prettier       |

## How the data is fetched

The server calls the public JSON endpoints behind the City's ActiveNet online
calendar. No login or API key is involved, the browser never calls the City
directly, and requests are cached and throttled to keep the load on the City's
servers low. Details are in [docs/data-source.md](docs/data-source.md).

## Project layout

```
docs/         plan, architecture and data-source notes
public/       static assets
src/app/      pages and API routes (Next.js App Router)
tests/        unit tests and recorded API fixtures
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[code of conduct](CODE_OF_CONDUCT.md). To report a security problem, see
[SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE)
