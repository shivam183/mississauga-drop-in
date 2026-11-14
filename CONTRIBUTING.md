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
npm run lint
npm run typecheck
npm test
npm run build
```

Also:

- Keep pull requests small and focused on one change.
- Add or update tests for any logic you change.
- Update `CHANGELOG.md` under **Unreleased**.
- Check the change on a phone-sized screen (375px wide).

## Being kind to the City's servers

This app reads data from the City of Mississauga's public ActiveNet site.

- Tests must use recorded fixtures in `tests/fixtures/`, never live requests.
- Do not remove or loosen the request throttling or caching.
- All requests to the City happen on the server, never from the browser.

## Commit messages

Use short, imperative subjects, for example `Add centre filter to search`.

## Licence

By contributing, you agree that your contributions are licensed under the
[MIT licence](LICENSE).
