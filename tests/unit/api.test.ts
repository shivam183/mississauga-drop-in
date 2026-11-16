import { describe, expect, it } from "vitest";
import { API_DEFAULT_LIMIT, API_MAX_LIMIT, parsePage, toApiSession, torontoIso } from "@/lib/api";
import { toRawSearchParams } from "@/lib/params";
import type { Session } from "@/models/session";

describe("torontoIso", () => {
  it("adds Toronto's offset in winter (EST) and summer (EDT)", () => {
    expect(torontoIso("2026-11-15 07:30:00")).toBe("2026-11-15T07:30:00-05:00");
    expect(torontoIso("2026-07-01 18:00:00")).toBe("2026-07-01T18:00:00-04:00");
  });

  it("is right on the days the clocks change", () => {
    // 2026-03-08: clocks go forward at 2 am; 2026-11-01: back at 2 am.
    expect(torontoIso("2026-03-08 01:30:00")).toBe("2026-03-08T01:30:00-05:00");
    expect(torontoIso("2026-03-08 09:00:00")).toBe("2026-03-08T09:00:00-04:00");
    expect(torontoIso("2026-11-01 00:30:00")).toBe("2026-11-01T00:30:00-04:00");
    expect(torontoIso("2026-11-01 09:00:00")).toBe("2026-11-01T09:00:00-05:00");
  });

  it("round-trips to the same instant", () => {
    const iso = torontoIso("2026-11-15 07:30:00");
    expect(new Date(iso).toISOString()).toBe("2026-11-15T12:30:00.000Z");
  });
});

describe("parsePage", () => {
  const page = (query: string) => parsePage(new URLSearchParams(query));

  it("defaults and accepts valid values", () => {
    expect(page("")).toEqual({ limit: API_DEFAULT_LIMIT, offset: 0 });
    expect(page(`limit=${API_MAX_LIMIT}&offset=400`)).toEqual({
      limit: API_MAX_LIMIT,
      offset: 400,
    });
  });

  it.each([
    "limit=0",
    `limit=${API_MAX_LIMIT + 1}`,
    "limit=abc",
    "limit=2.5",
    "offset=-1",
    "offset=x",
  ])("rejects %s", (query) => {
    expect(page(query)).toHaveProperty("error");
  });
});

describe("toRawSearchParams", () => {
  it("keeps repeated params as arrays", () => {
    expect(toRawSearchParams(new URLSearchParams("q=swim&centre=290&centre=119"))).toEqual({
      q: "swim",
      centre: ["290", "119"],
    });
  });

  it("can't be used to change an object's prototype", () => {
    const raw = toRawSearchParams(new URLSearchParams("__proto__=x&constructor=y&q=swim"));
    expect(Object.getPrototypeOf(raw)).toBe(Object.prototype);
    expect(Object.hasOwn(raw, "__proto__")).toBe(true);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    expect(raw.q).toBe("swim");
  });
});

describe("toApiSession", () => {
  it("nests the centre and uses ISO times", () => {
    const session: Session = {
      id: "e164373-202612310830",
      type: "enroll",
      title: "Drop In Adult Pickleball",
      centreId: 248,
      centreName: "Carmen Corbasson Community Centre",
      facility: "Gym A",
      start: "2026-12-31 08:30:00",
      end: "2026-12-31 10:30:00",
      activityId: 164373,
      url: "https://ca.apm.activecommunities.com/activemississauga/Activity_Search/x/164373",
      searchText: "drop in adult pickleball carmen corbasson community centre gym a",
    };
    expect(toApiSession(session)).toEqual({
      id: "e164373-202612310830",
      type: "enroll",
      title: "Drop In Adult Pickleball",
      centre: { id: 248, name: "Carmen Corbasson Community Centre" },
      facility: "Gym A",
      start: "2026-12-31T08:30:00-05:00",
      end: "2026-12-31T10:30:00-05:00",
      activityId: 164373,
      url: session.url,
    });
  });
});
