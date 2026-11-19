import { describe, expect, it } from "vitest";
import type {
  ActivitiesListBody,
  ActivityFiltersBody,
  Envelope,
  EstimatePriceBody,
  MeetingDatesBody,
  RawProgram,
} from "@/lib/activenet/types";
import {
  assertActivitiesListBody,
  assertActivityFiltersBody,
  assertEstimatePriceBody,
  assertMeetingDatesBody,
} from "@/lib/activenet/validate";
import {
  activeProgramFilterCount,
  agesLabel,
  EMPTY_PROGRAM_SEARCH,
  formatCityTimeRange,
  MAX_PAGES,
  meetingLines,
  parseProgramParams,
  programHref,
  programTypeIds,
  paymentPlan,
  toFees,
  toProgram,
  seasonStatus,
  toSearchPattern,
  upcomingSeasonIds,
  type SeasonInfo,
  type WeekdayKey,
} from "@/models/registered";
import { fixture } from "./fixtures";

const list = fixture<Envelope<ActivitiesListBody>>("activities.list.json");
const filters = fixture<Envelope<ActivityFiltersBody>>("activities.filters.json");
const fees = fixture<Envelope<EstimatePriceBody>>("estimateprice.json");
const meetings = fixture<Envelope<MeetingDatesBody>>("meetingdates.json");
const row = list.body.activity_items[0];
const NOW = "2026-11-18 12:00:00";
const at = (changes: Partial<RawProgram>): RawProgram => ({ ...row, ...changes });

describe("recorded activity search responses", () => {
  it("pass the shape checks", () => {
    expect(() => assertActivitiesListBody(list.body)).not.toThrow();
    expect(() => assertActivityFiltersBody(filters.body)).not.toThrow();
    expect(() => assertEstimatePriceBody(fees.body)).not.toThrow();
    expect(() => assertMeetingDatesBody(meetings.body)).not.toThrow();
  });

  it("report the total in page_info, beyond the 20-row page", () => {
    const pageInfo = list.headers.page_info as { total_records: number };
    expect(pageInfo.total_records).toBeGreaterThan(20);
  });

  it("list a drop-in type, which programTypeIds leaves out", () => {
    const ids = programTypeIds(filters.body.types);
    const dropIn = filters.body.types.find((t) => /drop in/i.test(t.desc))!;
    expect(dropIn).toBeDefined();
    expect(ids).not.toContain(dropIn.id);
    expect(ids.length).toBe(filters.body.types.length - 1);
  });
});

describe("toProgram", () => {
  it("maps a recorded row", () => {
    expect(toProgram(row, NOW)).toEqual({
      id: 158821,
      name: "H3O Swim For Life 1",
      centre: "Frank McKechnie Cmty Centre",
      days: "Sat",
      time: "8:30 – 9:00 AM",
      dates: "Sep 26 – Dec 12",
      ages: "At least 4y 9m but less than 15",
      status: { state: "full" }, // the City says "Full" even with total_open 3
      started: false,
      enrollUrl: expect.stringMatching(/^https:\/\/anc\.ca\.apm\.activecommunities\.com\//),
      // The City's own pages are on ca.apm…, its enroll pages on anc.ca.apm….
      cityUrl: expect.stringMatching(/^https:\/\/(anc\.)?ca\.apm\.activecommunities\.com\//),
    });
  });

  it("open, few, opening later and in progress", () => {
    const open = { urgent_message: { status_description: "" } };
    expect(toProgram(at({ ...open, total_open: 12 }), NOW).status).toEqual({
      state: "open",
      spots: 12,
      few: false,
    });
    expect(toProgram(at({ ...open, total_open: 2 }), NOW).status).toMatchObject({ few: true });
    expect(
      toProgram(at({ ...open, activity_online_start_time: "2026-11-24 07:00:00" }), NOW).status,
    ).toEqual({ state: "opens", at: "2026-11-24 07:00:00", spots: 3, few: true });
    expect(toProgram(at({ ...open, total_open: 0 }), NOW).status).toEqual({ state: "full" });
    const started = toProgram(at({ urgent_message: { status_description: "In progress" } }), NOW);
    expect(started.started).toBe(true);
    expect(started.status.state).toBe("open");
  });

  it("drops links that aren't the City's", () => {
    const p = toProgram(at({ enroll_now: { href: "https://evil.example/x" } }), NOW);
    expect(p.enrollUrl).toBeNull();
  });
});

describe("formatting", () => {
  it("time ranges", () => {
    expect(formatCityTimeRange("6:30 PM - 7:30 PM")).toBe("6:30 – 7:30 PM");
    expect(formatCityTimeRange("9:00 AM - Noon")).toBe("9:00 AM – 12:00 PM");
    expect(formatCityTimeRange("")).toBe("");
  });

  it("ages", () => {
    expect(agesLabel("At least 9 but less than 13")).toBe("Ages 9–12");
    expect(agesLabel("At least 18 but less than 100")).toBe("Ages 18+");
    expect(agesLabel("3 and up")).toBe("Ages 3+");
    expect(agesLabel("At least 4y 9m but less than 15")).toBe("Ages 4y 9m–14");
    expect(agesLabel("At least 4½ but less than 13")).toBe("Ages 4½–12");
    // The City sends ½ as an HTML entity.
    expect(toProgram(at({ ages: "At least 4&#189; but less than 13" }), NOW).ages).toBe(
      "At least 4½ but less than 13",
    );
    expect(agesLabel("All ages")).toBe("All ages");
  });

  it("fees, resident first; free", () => {
    expect(toFees(fees.body)).toEqual([
      { label: "Resident", price: "$288.00" },
      { label: "Non-resident", price: "$298.00" },
    ]);
    // Program 163721: package members get their own price, with every package listed.
    const packages = Array.from({ length: 81 }, (_, i) => `Fit: Package ${i}`).join(" , ");
    expect(
      toFees({
        estimateprice: {
          prices: [
            {
              details: [
                {
                  price: "$121.92",
                  description: `Resident<br>Member of package:<br>${packages}<br><br>`,
                },
                { price: "$152.40", description: "Resident, non-member" },
              ],
            },
          ],
        },
      }),
    ).toEqual([
      { label: "Resident, member", price: "$121.92" },
      { label: "Resident, non-member", price: "$152.40" },
    ]);
    expect(toFees({ estimateprice: { free: true } })).toEqual([{ label: "", price: "Free" }]);
    expect(toFees({ estimateprice: {} })).toEqual([]);
  });

  it("payment plan", () => {
    expect(paymentPlan("Fall 50% now+50% Oct 5")).toBe("50% now, 50% on Oct 5");
    expect(paymentPlan("Winter 50%now+50% Feb 5")).toBe("50% now, 50% on Feb 5");
    expect(paymentPlan("Pay in full at registration")).toBe("Pay in full at registration");
    expect(paymentPlan(null)).toBe("");
  });

  it("meeting pattern", () => {
    expect(meetingLines(meetings.body)).toEqual([
      { time: "Sat · 8:30 – 9:00 AM", dates: "Sep 26 – Dec 12" },
    ]);
  });
});

describe("/registered URL state", () => {
  it("reads valid params and ignores the rest", () => {
    expect(
      parseProgramParams({
        q: "  swim  lessons ",
        cat: "48",
        season: "17",
        age: "6",
        day: "SAT",
        centre: "261,119,abc",
        open: "1",
        pages: "99",
      }),
    ).toEqual({
      q: "swim lessons",
      category: "48",
      season: "17",
      age: 6,
      days: ["sat"],
      centreIds: [119, 261],
      open: true,
      pages: MAX_PAGES,
    });
    expect(parseProgramParams({ cat: "x", age: "-1", day: "funday", pages: "0" })).toEqual(
      EMPTY_PROGRAM_SEARCH,
    );
    expect(parseProgramParams({ age: "0" }).age).toBeNull();
    expect(parseProgramParams({ age: "1" }).age).toBe(1);
  });

  it("several days, from a link or the form; all seasons", () => {
    expect(parseProgramParams({ day: "thu,tue,xyz" }).days).toEqual(["tue", "thu"]);
    expect(parseProgramParams({ day: ["sat", "sun"] }).days).toEqual(["sun", "sat"]);
    expect(parseProgramParams({ season: "all" }).season).toBe("all");
    expect(programHref(EMPTY_PROGRAM_SEARCH, { days: ["tue", "thu"] })).toBe(
      "/registered?day=tue%2Cthu",
    );
  });

  it("any filter change starts at the first page", () => {
    const state = { ...EMPTY_PROGRAM_SEARCH, q: "swim", pages: 3 };
    expect(programHref(state, { days: ["mon"] })).toBe("/registered?q=swim&day=mon");
    expect(programHref(state, { pages: 4 })).toBe("/registered?q=swim&pages=4");
    expect(programHref(EMPTY_PROGRAM_SEARCH, {})).toBe("/registered");
  });

  it("counts active filters", () => {
    expect(activeProgramFilterCount(EMPTY_PROGRAM_SEARCH)).toBe(0);
    expect(activeProgramFilterCount({ ...EMPTY_PROGRAM_SEARCH, category: "48" })).toBe(0);
    expect(
      activeProgramFilterCount({ ...EMPTY_PROGRAM_SEARCH, age: 1, open: true, centreIds: [1] }),
    ).toBe(3);
  });
});

describe("toSearchPattern", () => {
  it("always sends the program types, Sunday-first weekday mask, age both ways", () => {
    const pattern = toSearchPattern(
      { ...EMPTY_PROGRAM_SEARCH, q: "swim", days: ["fri"], age: 6, centreIds: [261], open: true },
      ["1", "8", "5"],
    );
    expect(pattern).toEqual({
      activity_keyword: "swim",
      center_ids: ["261"],
      activity_category_ids: [],
      season_ids: [],
      activity_type_ids: ["1", "8", "5"],
      days_of_week: "0000010",
      min_age: 6,
      max_age: 6,
      open_spots: 1,
    });
    expect(toSearchPattern(EMPTY_PROGRAM_SEARCH, ["1"])).toMatchObject({
      days_of_week: null,
      min_age: null,
      open_spots: null,
    });
  });

  it("several days match any of them; seasons default to the upcoming ones", () => {
    const tueThu = { ...EMPTY_PROGRAM_SEARCH, days: ["tue", "thu"] as WeekdayKey[] };
    expect(toSearchPattern(tueThu, ["1"]).days_of_week).toBe("0010100");
    expect(toSearchPattern(EMPTY_PROGRAM_SEARCH, ["1"], ["36", "34"]).season_ids).toEqual([
      "34",
      "36",
    ]);
    const all = { ...EMPTY_PROGRAM_SEARCH, season: "all" };
    expect(toSearchPattern(all, ["1"], ["34"]).season_ids).toEqual([]);
    const one = { ...EMPTY_PROGRAM_SEARCH, season: "17" };
    expect(toSearchPattern(one, ["1"], ["34"]).season_ids).toEqual(["17"]);
  });
});

describe("seasons", () => {
  const now = "2026-11-18 12:00:00";
  const info: Record<string, SeasonInfo> = {
    fall: { count: 4302, start: "2026-09-08", opens: "" },
    late: { count: 10, start: "2026-11-09", opens: "" },
    winter: { count: 4704, start: "2027-01-02", opens: "2026-11-24 07:00:00" },
    empty: { count: 0, start: "", opens: "" },
  };

  it("upcoming: not started, or started in the last two weeks, with programs", () => {
    expect(upcomingSeasonIds(info, now)).toEqual(["late", "winter"]);
  });

  it("status for the Season filter", () => {
    expect(seasonStatus(info.winter, now)).toBe("registration opens Nov 24");
    expect(seasonStatus({ ...info.winter, opens: "2026-11-01 07:00:00" }, now)).toBe(
      "starts Jan 2",
    );
    expect(seasonStatus(info.fall, now)).toBe("in progress");
    expect(seasonStatus(info.empty, now)).toBe("");
  });
});
