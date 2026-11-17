# Changelog

This file is updated automatically by
[release-please](https://github.com/googleapis/release-please) from the
Conventional Commit messages on `main`. Don't edit it by hand. The project uses
[Semantic Versioning](https://semver.org/).

## [0.5.0](https://github.com/shivam183/mississauga-drop-in/compare/v0.4.0...v0.5.0) (2026-11-17)


### Features

* "On now" and "Starts in N min" labels ([#36](https://github.com/shivam183/mississauga-drop-in/issues/36)) ([ed34ecd](https://github.com/shivam183/mississauga-drop-in/commit/ed34ecdbee01f4d461169750a5065aec30d81be3))
* activity chips; type moves into the filters ([#35](https://github.com/shivam183/mississauga-drop-in/issues/35)) ([b59d6c5](https://github.com/shivam183/mississauga-drop-in/commit/b59d6c5c04c32f8f1a319e55f37f20553647eb68))
* add a Mississauga skyline pin logo as the site icon and header mark ([#51](https://github.com/shivam183/mississauga-drop-in/issues/51)) ([5d8e0ec](https://github.com/shivam183/mississauga-drop-in/commit/5d8e0eca9c131880c667228f99fd2062baf76a68))
* add a share card image and WebSite structured data ([#52](https://github.com/shivam183/mississauga-drop-in/issues/52)) ([68146f4](https://github.com/shivam183/mississauga-drop-in/commit/68146f4919ecb0df17d941987773fb71f53fe48c))
* add Buy Me a Coffee and a livelier README ([#53](https://github.com/shivam183/mississauga-drop-in/issues/53)) ([a5544aa](https://github.com/shivam183/mississauga-drop-in/commit/a5544aa79ed73d85761415388d12a61be99ce08a))
* add robots.txt, sitemap and canonical URL for search engines ([#50](https://github.com/shivam183/mississauga-drop-in/issues/50)) ([472901e](https://github.com/shivam183/mississauga-drop-in/commit/472901ec1d0a1a26c0c477539f3d8538b008112f))
* collapse a day by tapping its heading; the page refills ([#48](https://github.com/shivam183/mississauga-drop-in/issues/48)) ([ac65959](https://github.com/shivam183/mississauga-drop-in/commit/ac65959a8e6b865d1f359d818b4a866b22fdc1ea))
* Share button on each card ([#38](https://github.com/shivam183/mississauga-drop-in/issues/38)) ([ac45b65](https://github.com/shivam183/mississauga-drop-in/commit/ac45b6592daaef4ec25035cbb28c6036162bdb32))
* shared links open exactly one session, one detail per line ([#39](https://github.com/shivam183/mississauga-drop-in/issues/39)) ([3357d18](https://github.com/shivam183/mississauga-drop-in/commit/3357d18b047be2f909d0f27ccb32f9b12c61fff0))


### Bug Fixes

* build raw search params with Object.fromEntries ([#49](https://github.com/shivam183/mississauga-drop-in/issues/49)) ([ef0f6df](https://github.com/shivam183/mississauga-drop-in/commit/ef0f6df6fa844482be3652fbced6fb3c77f3dbff))
* opening the filters doesn't pop up the phone keyboard ([#41](https://github.com/shivam183/mississauga-drop-in/issues/41)) ([e0a213b](https://github.com/shivam183/mississauga-drop-in/commit/e0a213ba302adc76f82a3cc2311dcdfdfe9ec637))


### Performance

* check in-memory cache before the billed remote cache ([#44](https://github.com/shivam183/mississauga-drop-in/issues/44)) ([16cb547](https://github.com/shivam183/mississauga-drop-in/commit/16cb54779c554b1cecd144da5caa67ec82f3d34f))
* store schedules packed by activity in the remote cache ([#45](https://github.com/shivam183/mississauga-drop-in/issues/45)) ([cb80f73](https://github.com/shivam183/mississauga-drop-in/commit/cb80f73242a32cbfc553352f108c9bc7a657dfe2))


### Documentation

* bring PLAN.md up to date and spec collapsible day sections ([#47](https://github.com/shivam183/mississauga-drop-in/issues/47)) ([4a25e8c](https://github.com/shivam183/mississauga-drop-in/commit/4a25e8c943f47003db0d410bb7cb8ac8c0e8bcf4))
* consolidate PLAN.md and spec Phase 7 (details popup, activity and centre pages) ([#54](https://github.com/shivam183/mississauga-drop-in/issues/54)) ([4fbff93](https://github.com/shivam183/mississauga-drop-in/commit/4fbff938b153f2361d6243b5bf331a421e94de44))

## [0.4.0](https://github.com/shivam183/mississauga-drop-in/compare/v0.3.0...v0.4.0) (2026-11-15)


### Features

* add a "Report a problem" link to the footer ([#25](https://github.com/shivam183/mississauga-drop-in/issues/25)) ([15966a0](https://github.com/shivam183/mississauga-drop-in/commit/15966a05842ebcee8a59ac6da1ca22c399f00155))
* Install Vercel Speed Insights ([#21](https://github.com/shivam183/mississauga-drop-in/issues/21)) ([cb37d14](https://github.com/shivam183/mississauga-drop-in/commit/cb37d148a7e9b1d832071a468e16b31fe895f859))


### Bug Fixes

* a refresh expires the cached spots so others don't keep the old count ([#31](https://github.com/shivam183/mississauga-drop-in/issues/31)) ([823d220](https://github.com/shivam183/mississauga-drop-in/commit/823d220fda09eb0181a9b874fb4d4cf1192523fb))
* drop the redundant ActiveMississauga link on full sessions ([#34](https://github.com/shivam183/mississauga-drop-in/issues/34)) ([9220f18](https://github.com/shivam183/mississauga-drop-in/commit/9220f18446460e55daf039e5ce19d76eff168985))


### Performance

* cache the merged schedule, not just its batches ([#28](https://github.com/shivam183/mississauga-drop-in/issues/28)) ([5c92f17](https://github.com/shivam183/mississauga-drop-in/commit/5c92f177ad976c7c0d876b54f76aa67122105870))
* fold each session's search text once, when it's cached ([#29](https://github.com/shivam183/mississauga-drop-in/issues/29)) ([1c5c45d](https://github.com/shivam183/mississauga-drop-in/commit/1c5c45daac58aa5c2b9df9a6fc5284bd7940cea5))
* re-render only the Enroll panels whose availability changed ([#30](https://github.com/shivam183/mississauga-drop-in/issues/30)) ([6a1b40a](https://github.com/shivam183/mississauga-drop-in/commit/6a1b40a1f26effb4148c46685f692fd8fe65ba9b))

## [0.3.0](https://github.com/shivam183/mississauga-drop-in/compare/v0.2.1...v0.3.0) (2026-11-15)


### ⚠ BREAKING CHANGES

* add a clear button to search; spell "Enroll" with two Ls ([#19](https://github.com/shivam183/mississauga-drop-in/issues/19))

### Features

* add a clear button to search; spell "Enroll" with two Ls ([#19](https://github.com/shivam183/mississauga-drop-in/issues/19)) ([87ff430](https://github.com/shivam183/mississauga-drop-in/commit/87ff430d88aa8fbf60ea0ed6640451d5b3bebfa0))

## [0.2.1](https://github.com/shivam183/mississauga-drop-in/compare/v0.2.0...v0.2.1) (2026-11-15)


### Bug Fixes

* share the schedule cache across Vercel instances; show link loading spinner ([#17](https://github.com/shivam183/mississauga-drop-in/issues/17)) ([03f20db](https://github.com/shivam183/mississauga-drop-in/commit/03f20db35e1e3703adf1e203bb456eab5180953b))

## [0.2.0](https://github.com/shivam183/mississauga-drop-in/compare/v0.1.0...v0.2.0) (2026-11-15)


### Features

* open details from anywhere on a card; centre name adds a filter ([#16](https://github.com/shivam183/mississauga-drop-in/issues/16)) ([cdfde4b](https://github.com/shivam183/mississauga-drop-in/commit/cdfde4b3008089261de20b0133a4d10200461da3))


### Documentation

* mark phase 5 done ([#14](https://github.com/shivam183/mississauga-drop-in/issues/14)) ([a938dde](https://github.com/shivam183/mississauga-drop-in/commit/a938ddeeb9af85f09be18e904fc942c5b712d170))

## 0.1.0 (2026-11-14)


### Features

* add ActiveNet data layer and verify the API ([105d5d3](https://github.com/shivam183/mississauga-drop-in/commit/105d5d3c22040e5b91560a4ff3467b11e2dd2080))
* add mobile-first search with live spots and centre pages ([ebeee66](https://github.com/shivam183/mississauga-drop-in/commit/ebeee66dad06517bd4af01ebc4f1495d6de002ef))
* add public JSON API for centres, sessions and availability ([2fa3fe4](https://github.com/shivam183/mississauga-drop-in/commit/2fa3fe42ad098ba361e5e881e4bfd3f82a522320))
* add session model, filters and cached schedule and availability services ([cb66288](https://github.com/shivam183/mississauga-drop-in/commit/cb662883c965c040aaab35065f9eb46072a9d8c1))


### Bug Fixes

* add security headers (CSP, nosniff, referrer and permissions policy) ([19eaa9c](https://github.com/shivam183/mississauga-drop-in/commit/19eaa9c4e329f1c2ddc869d5b5f107cec12c5e7d))
* **deps:** bump the react group with 2 updates ([#10](https://github.com/shivam183/mississauga-drop-in/issues/10)) ([f386204](https://github.com/shivam183/mississauga-drop-in/commit/f3862047785a5c7a7bcd10957dc254e031c67efe))


### Documentation

* reword the home page heading and credit ActiveMississauga ([be1e304](https://github.com/shivam183/mississauga-drop-in/commit/be1e30468634d7eb8058af64a6428c66ce11f5c5))

## 0.0.0 (project setup)

- Project skeleton: Next.js (App Router) + TypeScript, Vitest, ESLint, Prettier.
- Open source files: licence, contributing guide, code of conduct, security policy,
  issue and pull request templates, CI and Dependabot.
- GitHub automation: release-please, PR title check, CodeQL and Dependabot auto-merge.
