import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  displayTitle,
  formatCheckedAt,
  formatDate,
  formatDateTime,
  formatDayHeading,
  formatTimeRange,
} from "@/lib/format";
import {
  activeFilterCount,
  EMPTY_SEARCH,
  hrefWith,
  MAX_LIMIT,
  PAGE_SIZE,
  parseSearchParams,
  toFilters,
  toQueryString,
} from "@/lib/params";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

describe("format", () => {
  it("formats time ranges", () => {
    expect(formatTimeRange("2026-11-14 19:00:00", "2026-11-14 21:00:00")).toBe("7:00 – 9:00 PM");
    expect(formatTimeRange("2026-11-14 11:30:00", "2026-11-14 13:00:00")).toBe(
      "11:30 AM – 1:00 PM",
    );
    expect(formatTimeRange("2026-11-14 00:15:00", "2026-11-14 12:00:00")).toBe(
      "12:15 AM – 12:00 PM",
    );
  });

  it("formats dates and day headings", () => {
    expect(formatDate("2026-11-14")).toBe("Sat Nov 14");
    expect(formatDayHeading("2026-11-14", "2026-11-14")).toBe("Today · Sat Nov 14");
    expect(formatDayHeading("2026-11-15", "2026-11-14")).toBe("Tomorrow · Sun Nov 15");
    expect(formatDayHeading("2026-11-16", "2026-11-14")).toBe("Mon Nov 16");
    expect(formatDateTime("2026-12-30 07:00:00")).toBe("Wed Dec 30, 7:00 AM");
  });

  it("does date arithmetic across months", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("formats when a count was checked, in Toronto time", () => {
    expect(formatCheckedAt("2026-11-14T20:42:00Z")).toBe("3:42 pm");
  });

  it("drops the 'Drop In' prefix from titles", () => {
    expect(displayTitle("Drop In Adult Pickleball")).toBe("Adult Pickleball");
    expect(displayTitle("Drop-In Zumba®")).toBe("Zumba®");
    expect(displayTitle("Adult Leisure Swim")).toBe("Adult Leisure Swim");
  });
});

describe("params", () => {
  it("parses valid params", () => {
    const state = parseSearchParams({
      q: "  pickle   ball ",
      type: "enroll",
      centre: ["290", "119,999999"],
      from: "2026-11-20",
      to: "2026-11-16",
      time: "evening,bogus,morning",
      limit: "100",
    });
    expect(state).toEqual({
      q: "pickle ball",
      type: "enroll",
      centreIds: [119, 290],
      from: "2026-11-16",
      to: "2026-11-20",
      times: ["morning", "evening"],
      limit: 4 * PAGE_SIZE, // rounded up to whole pages
    });
  });

  it("reads the filter form's day picker", () => {
    expect(parseSearchParams({ day: "2026-11-16" })).toMatchObject({
      from: "2026-11-16",
      to: "2026-11-16",
    });
    // A day overrides a range; "any" clears it; "keep" keeps it.
    const range = { from: "2026-11-16", to: "2026-11-20" };
    expect(parseSearchParams({ ...range, day: "2026-11-18" })).toMatchObject({
      from: "2026-11-18",
      to: "2026-11-18",
    });
    expect(parseSearchParams({ ...range, day: "any" })).toMatchObject({ from: null, to: null });
    expect(parseSearchParams({ ...range, day: "keep" })).toMatchObject(range);
  });

  it("accepts a centre by name, as the type-ahead sends it", () => {
    expect(parseSearchParams({ centre: "burnhamthorpe  community centre " }).centreIds).toEqual([
      290,
    ]);
    expect(parseSearchParams({ centre: "Burnham" }).centreIds).toEqual([]);
  });

  it("ignores invalid values", () => {
    expect(
      parseSearchParams({
        type: "x",
        centre: "abc",
        from: "2026-02-30",
        time: "noon",
        limit: "-5",
      }),
    ).toEqual(EMPTY_SEARCH);
    expect(parseSearchParams({ limit: "99999" }).limit).toBe(MAX_LIMIT);
    expect(parseSearchParams({ q: "x".repeat(500) }).q).toHaveLength(100);
  });

  it("round-trips through the query string and leaves out defaults", () => {
    expect(toQueryString(EMPTY_SEARCH)).toBe("");
    const state = parseSearchParams({ q: "swim", centre: "290", time: "morning" });
    expect(toQueryString(state)).toBe("?q=swim&centre=290&time=morning");
    expect(
      parseSearchParams(Object.fromEntries(new URLSearchParams(toQueryString(state)))),
    ).toEqual(state);
  });

  it("builds links that change one thing and reset the result count", () => {
    const state = { ...EMPTY_SEARCH, q: "swim", limit: 2 * PAGE_SIZE };
    expect(hrefWith("/", state, { type: "dropin" })).toBe("/?q=swim&type=dropin");
    expect(hrefWith("/", state, { limit: state.limit + PAGE_SIZE })).toBe(
      `/?q=swim&limit=${3 * PAGE_SIZE}`,
    );
  });

  it("converts to model filters and counts extra filters", () => {
    const state = parseSearchParams({ centre: "290", time: "morning", from: "2026-11-16" });
    expect(toFilters(state)).toMatchObject({
      centreIds: [290],
      timesOfDay: ["morning"],
      from: "2026-11-16",
    });
    expect(activeFilterCount(state)).toBe(3);
    expect(activeFilterCount(EMPTY_SEARCH)).toBe(0);
    // Each centre and each time of day counts; a day range counts once.
    const many = parseSearchParams({
      centre: "290,119,248,261",
      time: "morning,evening",
      from: "2026-11-16",
      to: "2026-11-20",
    });
    expect(activeFilterCount(many)).toBe(7);
  });
});

describe("rate limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it("allows `limit` hits per window per key", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect([limiter.allow("a"), limiter.allow("a"), limiter.allow("a")]).toEqual([
      true,
      true,
      false,
    ]);
    expect(limiter.allow("b")).toBe(true);
    vi.setSystemTime(60_000);
    expect(limiter.allow("a")).toBe(true);
  });

  it("caps the number of tracked keys", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 2 });
    limiter.allow("a");
    limiter.allow("b");
    limiter.allow("c");
    expect(limiter.allow("a")).toBe(true); // "a" was evicted, so it starts a new window
  });

  it("reads the client IP from proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe(
      "203.0.113.5",
    );
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
