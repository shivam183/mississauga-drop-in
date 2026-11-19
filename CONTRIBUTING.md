# Contributing

Thanks for helping make Mississauga's recreation programs easier to find.

## Ways to help

- Report a bug or a confusing screen with the **Bug report** issue template.
- Suggest a feature with the **Feature request** template.
- Pick up an issue labelled `good first issue` or `help wanted`.

## Development setup

1. Install Node.js 22 (`.nvmrc` is provided, so `nvm use` works).
2. Fork and clone the repository, then run `npm install`.
3. Start the app with `npm run dev` and open http://localhost:3000.

## Before you open a pull request

Run the same checks as CI:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run e2e   # first time: npx playwright install chromium
```

The end-to-end tests build the app and run it against `e2e/mock-activenet.mjs`, a
mock of the City API that serves the recorded fixtures, so they never call the City.

Also:

- Keep pull requests small and focused on one change.
- Add or update tests for any logic you change.
- Give the pull request a Conventional Commit title (see below). Don't edit
  `CHANGELOG.md`; it is generated at release time.
- Check the change on a phone-sized screen (375px wide).

## Being kind to the City's servers

This app reads data from the City of Mississauga's public ActiveNet site.

- Tests must use recorded fixtures in `tests/fixtures/`, never live requests.
- Do not remove or loosen the request throttling or caching.
- All requests to the City happen on the server, never from the browser.

## Commit messages

Pull requests are squash-merged, so the **pull request title** becomes the
commit message on `main`. It must follow
[Conventional Commits](https://www.conventionalcommits.org/), and a CI check
enforces this:

- `feat: add centre filter to search` adds a feature and goes in the changelog.
- `fix(enroll): show Full when the notice says full` fixes a bug and goes in the changelog.
- `docs:`, `perf:` and `revert:` also go in the changelog.
- `refactor:`, `test:`, `build:`, `ci:`, `chore:` and `style:` are left out.
- Add `!` after the type (`feat!:`) for a breaking change.

## Releases

Releases are automated with release-please. It keeps a "chore: release" pull
request open with the next version and changelog. A maintainer merges it to
tag the release and publish a GitHub Release. Every merge to `main` deploys to
production on Vercel, and every pull request gets a preview deployment.

## Licence

By contributing, you agree that your contributions are licensed under the
[MIT licence](LICENSE).
