/**
 * The schedule and availability services end to end, with the City's API
 * replaced by recorded fixtures and Next's cache functions stubbed out.
 */
import { revalidateTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setActiveNetClient } from "@/lib/activenet";
import { createActiveNetClient } from "@/lib/activenet/client";
import { createThrottle } from "@/lib/activenet/throttle";
import type { Envelope, EventsBody, EventsQuery } from "@/lib/activenet/types";
import { getAvailability, MAX_AVAILABILITY_IDS } from "@/lib/availability";
import { CENTRES_BY_TYPE } from "@/lib/centres";
import { CENTRES_PER_REQUEST, getSchedule } from "@/lib/schedule";
import { toEnrollState } from "@/models/availability";
import { fixture } from "./fixtures";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), revalidateTag: vi.fn() }));

// 3:00 pm in Toronto on the day the fixtures were captured.
const NOW = new Date("2026-11-14T20:00:00Z");

/** Calendar 3 sessions at centre 290 matching the recorded detail/buttonstatus fixtures. */
function enrollEvents(): Envelope<EventsBody> {
  const envelope = fixture<Envelope<EventsBody>>("events.3.json");
  const template = envelope.body.center_events[0].events[0];
  const at = (id: number, start: string, end: string) => ({
    ...structuredClone(template),
    event_item_id: id,
    start_time: start,
    end_time: end,
  });
  envelope.body.center_events[0].events = [
    at(166860, "2026-11-14 16:30:00", "2026-11-14 18:30:00"), // enroll now (fixture)
    at(164542, "2026-11-14 17:15:00", "2026-11-14 19:15:00"), // full (fixture)
    at(164373, "2026-12-31 08:30:00", "2026-12-31 10:30:00"), // opens later (fixture)
    at(164222, "2026-11-14 11:30:00", "2026-11-14 13:30:00"), // already over
  ];
  envelope.body.center_events[0].total = 4;
  return envelope;
}

const DETAIL: Record<number, string> = {
  166860: "detail.3.open.json",
  164542: "detail.3.full.json",
  164373: "detail.3.open.json",
};
const BUTTON: Record<number, string> = {
  166860: "buttonstatus.3.enroll.json",
  164542: "buttonstatus.3.full.json",
  164373: "buttonstatus.3.opens.json",
};

let failing: { calendar?: number; activityId?: number } = {};
const requests: string[] = [];

const fakeFetch = vi.fn<typeof fetch>(async (input, init) => {
  const url = String(input);
  requests.push(url);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  if (url.endsWith("/multicenter/events")) {
    const query = JSON.parse(String(init?.body)) as EventsQuery;
    if (query.calendar_id === failing.calendar) return json({}, 503);
    const envelope =
      query.calendar_id === 3 ? enrollEvents() : fixture<Envelope<EventsBody>>("events.1.json");
    envelope.body.center_events = envelope.body.center_events.filter((c) =>
      query.center_ids.includes(c.center_id),
    );
    return json(envelope);
  }

  const id = Number(url.match(/\/(\d+)\?/)?.[1]);
  if (id === failing.activityId) return json({}, 500);
  const file = url.includes("/buttonstatus/") ? BUTTON[id] : DETAIL[id];
  if (!file) return json({}, 404);
  const envelope = fixture<{ headers: unknown; body: { detail?: { activity_id: number } } }>(file);
  if (envelope.body.detail) envelope.body.detail.activity_id = id;
  return json(envelope);
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  failing = {};
  requests.length = 0;
  fakeFetch.mockClear();
  setActiveNetClient(
    createActiveNetClient({ fetch: fakeFetch, throttle: createThrottle({ minIntervalMs: 0 }) }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  setActiveNetClient();
});

describe("getSchedule", () => {
  it("loads both calendars in batches and merges them", async () => {
    const { sessions, failedCentres } = await getSchedule();
    const batches =
      Math.ceil(CENTRES_BY_TYPE.dropin.length / CENTRES_PER_REQUEST) +
      Math.ceil(CENTRES_BY_TYPE.enroll.length / CENTRES_PER_REQUEST);
    expect(requests.filter((u) => u.endsWith("/multicenter/events"))).toHaveLength(batches);
    expect(failedCentres).toEqual([]);
    expect(new Set(sessions.map((s) => s.type))).toEqual(new Set(["dropin", "enroll"]));
    const starts = sessions.map((s) => s.start);
    expect(starts).toEqual([...starts].sort());
  });

  it("reports the centres of a batch that failed and keeps the rest", async () => {
    failing = { calendar: 3 };
    const { sessions, failedCentres } = await getSchedule();
    expect(failedCentres.map((c) => c.id).sort()).toEqual(
      CENTRES_BY_TYPE.enroll.map((c) => c.id).sort(),
    );
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((s) => s.type === "dropin")).toBe(true);
  });
});

describe("getAvailability", () => {
  it("returns a status per session, and the right Enroll button for each", async () => {
    const result = await getAvailability([166860, 164542, 164373]);
    expect(result.unknownIds).toEqual([]);
    expect(result.failedIds).toEqual([]);
    const now = "2026-11-14 15:00:00";
    expect(toEnrollState(result.statuses[166860], now).state).toBe("enroll");
    expect(result.statuses[166860].spaces).toEqual({ level: "open", count: 8 });
    expect(toEnrollState(result.statuses[164542], now).state).toBe("full");
    expect(toEnrollState(result.statuses[164373], now)).toMatchObject({
      state: "opens",
      opensAt: "2026-12-30 07:00:00",
    });
    expect(result.statuses[166860].checkedAt).toBe(NOW.toISOString());
  });

  it("a fresh lookup also expires the cached spots, so others don't keep the older count", async () => {
    vi.mocked(revalidateTag).mockClear();
    await getAvailability([166860]);
    expect(revalidateTag).not.toHaveBeenCalled();
    const result = await getAvailability([166860], { fresh: true });
    expect(result.statuses[166860]).toBeDefined();
    expect(revalidateTag).toHaveBeenCalledWith("spots-166860", { expire: 0 });
  });

  it("only looks up upcoming enroll-online sessions", async () => {
    const result = await getAvailability([166860, 164222, 999999]);
    expect(result.unknownIds).toEqual([164222, 999999]);
    expect(Object.keys(result.statuses)).toEqual(["166860"]);
    expect(requests.some((u) => /\/(164222|999999)\?/.test(u))).toBe(false);
  });

  it("reports failed lookups without failing the others", async () => {
    failing = { activityId: 164542 };
    const result = await getAvailability([166860, 164542]);
    expect(result.failedIds).toEqual([164542]);
    expect(result.statuses[166860]).toBeDefined();
  });

  it("rejects bad or too many ids before calling the City", async () => {
    await expect(getAvailability([1.5])).rejects.toThrow(RangeError);
    await expect(
      getAvailability(Array.from({ length: MAX_AVAILABILITY_IDS + 1 }, (_, i) => i + 1)),
    ).rejects.toThrow(RangeError);
    expect(fakeFetch).not.toHaveBeenCalled();
  });
});
