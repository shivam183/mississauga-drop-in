import { describe, expect, it } from "vitest";
import { filterSessions, foldText, pageDays, timeOfDay } from "@/models/filters";
import type { Session } from "@/models/session";

function session(overrides: Partial<Session>): Session {
  const s = {
    id: overrides.id ?? `x-${Math.random()}`,
    type: "dropin" as const,
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
  return { searchText: foldText(`${s.title} ${s.centreName} ${s.facility}`), ...s };
}

const now = "2026-11-15 12:00:00";
const sessions: Session[] = [
  session({ id: "ended", start: "2026-11-15 09:00:00", end: "2026-11-15 11:00:00" }),
  session({ id: "running", start: "2026-11-15 11:30:00", end: "2026-11-15 13:00:00" }),
  session({
    id: "pickle",
    type: "enroll",
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

  it("shows only the shared session, if it hasn't ended", () => {
    expect(ids(filterSessions(sessions, { sessionId: "zumba" }, now))).toEqual(["zumba"]);
    expect(ids(filterSessions(sessions, { sessionId: "ended" }, now))).toEqual([]);
  });

  it("filters by type", () => {
    expect(ids(filterSessions(sessions, { type: "enroll" }, now))).toEqual(["pickle"]);
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
});

describe("pageDays", () => {
  const all = () => filterSessions(sessions, {}, now);
  const shape = (page: ReturnType<typeof pageDays>) =>
    page.days.map((d) => [d.date, d.collapsed ? "collapsed" : ids(d.sessions)]);

  it("with nothing collapsed, groups the first `limit` sessions by day, in order", () => {
    expect(shape(pageDays(all(), 30, []))).toEqual([
      ["2026-11-15", ["running", "pickle"]],
      ["2026-11-16", ["zumba"]],
      ["2026-11-18", ["swim"]],
    ]);
    const page = pageDays(all(), 3, []);
    expect(shape(page)).toEqual([
      ["2026-11-15", ["running", "pickle"]],
      ["2026-11-16", ["zumba"]],
    ]);
    expect(page).toMatchObject({ shown: 3, more: true });
    expect(pageDays(all(), 4, [])).toMatchObject({ shown: 4, more: false });
  });

  it("collapsed days keep their heading but don't use up the page", () => {
    const page = pageDays(all(), 2, ["2026-11-15"]);
    expect(shape(page)).toEqual([
      ["2026-11-15", "collapsed"],
      ["2026-11-16", ["zumba"]],
      ["2026-11-18", ["swim"]],
    ]);
    expect(page).toMatchObject({ shown: 2, more: false });
  });

  it("a one-day page previews the next open day, past collapsed days", () => {
    const page = pageDays(all(), 2, ["2026-11-16"]);
    expect(shape(page)).toEqual([
      ["2026-11-15", ["running", "pickle"]],
      ["2026-11-16", "collapsed"],
      ["2026-11-18", ["swim"]],
    ]);
    expect(page).toMatchObject({ shown: 3, more: false });
  });

  it("a one-day page with more of that day keeps the rest behind Show more", () => {
    const page = pageDays(all(), 1, []);
    expect(shape(page)).toEqual([
      ["2026-11-15", ["running"]],
      ["2026-11-16", ["zumba"]],
    ]);
    expect(page).toMatchObject({ shown: 2, more: true });
  });

  it("a page with two or more open days has no preview", () => {
    const page = pageDays(all(), 3, []);
    expect(shape(page)).toEqual([
      ["2026-11-15", ["running", "pickle"]],
      ["2026-11-16", ["zumba"]],
    ]);
  });

  it("with every day collapsed, shows only headings and nothing more to load", () => {
    const page = pageDays(all(), 30, ["2026-11-15", "2026-11-16", "2026-11-18"]);
    expect(shape(page)).toEqual([
      ["2026-11-15", "collapsed"],
      ["2026-11-16", "collapsed"],
      ["2026-11-18", "collapsed"],
    ]);
    expect(page).toMatchObject({ shown: 0, more: false });
  });
});
