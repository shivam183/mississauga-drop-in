import { describe, expect, it } from "vitest";
import type { Envelope, EventsBody } from "@/lib/activenet/types";
import {
  mergeSessions,
  normalizeEvents,
  roomName,
  sessionId,
  type Session,
} from "@/models/session";
import { fixture } from "./fixtures";

const events1 = fixture<Envelope<EventsBody>>("events.1.json").body;
const events3 = fixture<Envelope<EventsBody>>("events.3.json").body;

describe("roomName", () => {
  it.each([
    [
      "Churchill Mdws CC Gym 2,3 (Full Court)",
      "Churchill Meadows Community Centre",
      "Gym 2,3 (Full Court)",
    ],
    ["Huron Park RC Gym A,B", "Huron Park Recreation Centre", "Gym A,B"],
    ["Miss Seniors' Cntr Lucy Turnbull N", "Mississauga Seniors' Centre", "Lucy Turnbull N"],
    ["Miss Valley CC Arena - Rink", "Mississauga Valley Community Centre", "Arena - Rink"],
    ["Port Credit Mem Arena Rink", "Port Credit Memorial Arena", "Rink"],
    ["Iceland Arena Rink 3", "Iceland Arena", "Rink 3"],
    ["Mattamy SP Dome - Half Field 2-3", "Mattamy Sports Park", "Dome - Half Field 2-3"],
    [
      "MSEC SPORTSPLEX Fitness Centre",
      "Mississauga Sports and Ent. Centre SportsPlex",
      "Fitness Centre",
    ],
  ])("%s -> %s", (facility, centre, expected) => {
    expect(roomName(facility, centre)).toBe(expected);
  });

  it("keeps names it doesn't recognise", () => {
    expect(roomName("Gym A", "Malton Community Centre")).toBe("Gym A");
    expect(roomName("Clarkson CC Gym", "Malton Community Centre")).toBe("Clarkson CC Gym");
  });
});

describe("normalizeEvents", () => {
  it("turns calendar 3 events into enroll sessions", () => {
    const sessions = normalizeEvents(events3, 3);
    const raw = events3.center_events[0].events.find(
      (e) => e.event_item_id === sessions[0].activityId,
    )!;
    expect(sessions[0]).toEqual({
      id: sessionId("enroll", raw.event_item_id, raw.start_time),
      type: "enroll",
      title: raw.title,
      centreId: events3.center_events[0].center_id,
      centreName: events3.center_events[0].center_name,
      facility: expect.any(String),
      start: raw.start_time,
      end: raw.end_time,
      activityId: raw.event_item_id,
      url: raw.activity_detail_url,
    });
    expect(sessions[0].facility).not.toMatch(/\bCC\b/);
  });

  it("gives each calendar 1 session a unique id although activities repeat", () => {
    const sessions = normalizeEvents(events1, 1);
    expect(sessions).toHaveLength(events1.center_events[0].events.length);
    expect(new Set(sessions.map((s) => s.id)).size).toBe(sessions.length);
    expect(new Set(sessions.map((s) => s.activityId)).size).toBeLessThan(sessions.length);
    expect(sessions.every((s) => s.type === "dropin")).toBe(true);
  });

  it("sorts by start time and drops unsafe links", () => {
    const body: EventsBody = structuredClone(events3);
    body.center_events[0].events.reverse();
    body.center_events[0].events[0].activity_detail_url = "https://evil.example/x";
    const sessions = normalizeEvents(body, 3);
    const starts = sessions.map((s) => s.start);
    expect(starts).toEqual([...starts].sort());
    expect(sessions.filter((s) => s.url === null)).toHaveLength(1);
  });

  it("joins several rooms and skips duplicates", () => {
    const body: EventsBody = structuredClone(events3);
    const event = body.center_events[0].events[0];
    const facility = event.facilities[0];
    event.facilities = [
      { ...facility, facility_name: "Burnhamthorpe CC Gym A" },
      { ...facility, facility_name: "Burnhamthorpe CC Gym B" },
      { ...facility, facility_name: "Burnhamthorpe CC Gym A" },
    ];
    body.center_events[0].events.push(structuredClone(event));
    const sessions = normalizeEvents(body, 3);
    const session = sessions.find((s) => s.activityId === event.event_item_id)!;
    expect(session.facility).toBe("Gym A, Gym B");
    expect(sessions.filter((s) => s.activityId === event.event_item_id)).toHaveLength(1);
  });
});

describe("mergeSessions", () => {
  it("merges both calendars into one sorted list without duplicates", () => {
    const dropIn = normalizeEvents(events1, 1);
    const enroll = normalizeEvents(events3, 3);
    const merged: Session[] = mergeSessions(dropIn, enroll, enroll);
    expect(merged).toHaveLength(dropIn.length + enroll.length);
    for (let i = 1; i < merged.length; i++) {
      expect(merged[i - 1].start <= merged[i].start).toBe(true);
    }
  });
});
