import { describe, expect, it } from "vitest";
import { filterSessions, foldText, groupByDay, timeOfDay } from "@/models/filters";
import type { Session } from "@/models/session";

function session(overrides: Partial<Session>): Session {
  return {
    id: overrides.id ?? `x-${Math.random()}`,
    type: "dropin",
    title: "Drop In Badminton",
    centreId: 290,
    centreName: "Burnhamthorpe Community Centre",
    facility: "Gym A",
    start: "2026-11-15 09:00:00",
    end: "2026-11-15 10:00:00",
    activityId: 1,
    url: null,
    ...overrides,
  };
}

const now = "2026-11-15 12:00:00";
const sessions: Session[] = [
  session({ id: "ended", start: "2026-11-15 09:00:00", end: "2026-11-15 11:00:00" }),
  session({ id: "running", start: "2026-11-15 11:30:00", end: "2026-11-15 13:00:00" }),
  session({
    id: "pickle",
    type: "enrol",
    title: "Drop In Adult Pickleball",
    centreId: 119,
    centreName: "Meadowvale Community Centre",
    start: "2026-11-15 19:00:00",
    end: "2026-11-15 21:00:00",
  }),
  session({
    id: "zumba",
    title: "Drop In Zumba®",
    start: "2026-11-16 13:00:00",
    end: "2026-11-16 14:00:00",
  }),
  session({
    id: "swim",
    title: "Adult Leisure Swim",
    facility: "Therapeutic Pool",
    start: "2026-11-18 06:30:00",
    end: "2026-11-18 08:00:00",
  }),
];
const ids = (list: Session[]) => list.map((s) => s.id);

describe("filterSessions", () => {
  it("drops sessions that have ended but keeps ones in progress", () => {
    expect(ids(filterSessions(sessions, {}, now))).toEqual(["running", "pickle", "zumba", "swim"]);
  });

  it("filters by type", () => {
    expect(ids(filterSessions(sessions, { type: "enrol" }, now))).toEqual(["pickle"]);
    expect(ids(filterSessions(sessions, { type: "dropin" }, now))).not.toContain("pickle");
  });

  it("matches every word, across title, centre and room, ignoring case and symbols", () => {
    expect(ids(filterSessions(sessions, { q: "PICKLE meadowvale" }, now))).toEqual(["pickle"]);
    expect(ids(filterSessions(sessions, { q: "zumba" }, now))).toEqual(["zumba"]);
    expect(ids(filterSessions(sessions, { q: "therapeutic" }, now))).toEqual(["swim"]);
    expect(ids(filterSessions(sessions, { q: "pickle burnhamthorpe" }, now))).toEqual([]);
    expect(ids(filterSessions(sessions, { q: "  " }, now))).toHaveLength(4);
  });

  it("filters by centre, date range and time of day", () => {
    expect(ids(filterSessions(sessions, { centreIds: [119] }, now))).toEqual(["pickle"]);
    expect(ids(filterSessions(sessions, { from: "2026-11-16", to: "2026-11-17" }, now))).toEqual([
      "zumba",
    ]);
    expect(ids(filterSessions(sessions, { timesOfDay: ["morning", "evening"] }, now))).toEqual([
      "running",
      "pickle",
      "swim",
    ]);
  });
});

describe("helpers", () => {
  it("timeOfDay splits at noon and 5 pm", () => {
    expect(timeOfDay("2026-11-15 11:59:00")).toBe("morning");
    expect(timeOfDay("2026-11-15 12:00:00")).toBe("afternoon");
    expect(timeOfDay("2026-11-15 17:00:00")).toBe("evening");
  });

  it("foldText removes accents and symbols", () => {
    expect(foldText("Café Zumba® 55+")).toBe("cafe zumba 55");
  });

  it("groupByDay keeps order and groups by start date", () => {
    const groups = groupByDay(filterSessions(sessions, {}, now));
    expect(groups.map((g) => [g.date, ids(g.sessions)])).toEqual([
      ["2026-11-15", ["running", "pickle"]],
      ["2026-11-16", ["zumba"]],
      ["2026-11-18", ["swim"]],
    ]);
  });
});
