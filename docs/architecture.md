# Architecture

```
Browser ──► Next.js server (pages + /api routes)
                 │
                 ├─ src/lib/            services: schedule, enrollment, caching
                 │     └─ activenet/    raw ActiveNet client (throttled HTTP only)
                 └─ src/models/         pure data types and functions (no I/O)
```

- **`src/lib/activenet/`** knows the City's request and response shapes and
  nothing else.
- **`src/models/`** turns raw responses into `Session`, `Centre` and
  availability values. It is pure, so it is easy to unit test with fixtures.
- **`src/lib/`** combines the two with caching, and is what pages and API
  routes call.
- **Pages** render on the server from URL parameters, so every filtered view can
  be bookmarked and works without JavaScript. Only live spot counts load in the
  browser, through `/api/availability`.

See [PLAN.md](PLAN.md) for the roadmap and [data-source.md](data-source.md) for
the API.

## Caching

`"use cache"` with the profiles in `next.config.ts`:

| Function                                  | Profile    | Lifetime | Key                         |
| ----------------------------------------- | ---------- | -------- | --------------------------- |
| `getCentreBatch` (schedule.ts)            | `schedule` | 10 min   | calendar + up to 5 centres  |
| `getCachedButtonStatus` (availability.ts) | `schedule` | 10 min   | activity id + session start |
| `getCachedDetail` (availability.ts)       | `spots`    | 60 s     | activity id                 |
| `getActivityInfo` (activity.ts)           | `info`     | 1 day    | activity id                 |

All of these use `"use cache: remote"` (Vercel's Runtime Cache, shared by all
instances and billed per read). `getSchedule`, `getCachedDetail`,
`getCachedButtonStatus` and `getActivityInfo` also have a plain `"use cache"` (in-memory) layer in front,
so a warm instance answers repeat lookups without a billed read. As a result, a value
can be up to about twice its lifetime old.

`getActivityInfo` (the details popup) stores only the small `ActivityInfo` (about
1–2 KB, one read unit), not the City's raw response, and is only called for
drop-in activities with an upcoming session in the schedule. An enroll-online
session's details come from `getCachedDetail` instead, which its spots need
anyway, so the popup makes one City call, not two.

Reads are billed per 8 KB, so schedules are stored packed by activity
(`packSessions` in `src/models/session.ts`): about 780 KB instead of 3.4 MB.

Anything that depends on the current time, like hiding ended sessions or
deciding whether enrollment has opened, runs at request time, outside the cache.
Each spot count carries `checkedAt`, so the page can say "as of 3:42 pm".
