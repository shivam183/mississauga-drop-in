/**
 * Pins down the facts in docs/data-source.md using the recorded responses, so
 * a re-capture that contradicts them fails here.
 */
import { describe, expect, it } from "vitest";
import type { Envelope, EventsBody, RawButtonStatus } from "@/lib/activenet/types";
import {
  assertActivityDetailBody,
  assertButtonStatusBody,
  assertEnvelope,
  assertEventsBody,
  assertFiltersBody,
} from "@/lib/activenet/validate";
import { fixture } from "./fixtures";

const capture = fixture<{
  capturedAt: string;
  enroll: Record<"enroll" | "opens" | "full", { activityId: number; start: string }>;
}>("capture.json");

const bodyOf = (name: string) => {
  const json = fixture(name);
  assertEnvelope(json);
  expect(json.headers.response_code).toBe("0000");
  return json.body;
};
const status = (name: string) => (bodyOf(name) as { button_status: RawButtonStatus }).button_status;

describe("recorded fixtures match the validators", () => {
  it.each(["filters.1.json", "filters.3.json"])("%s", (name) => assertFiltersBody(bodyOf(name)));
  it.each(["events.1.json", "events.3.json"])("%s", (name) => assertEventsBody(bodyOf(name)));
  it.each(["detail.1.json", "detail.3.open.json", "detail.3.full.json"])("%s", (name) =>
    assertActivityDetailBody(bodyOf(name)),
  );
  it.each([
    "buttonstatus.1.json",
    "buttonstatus.3.enroll.json",
    "buttonstatus.3.opens.json",
    "buttonstatus.3.full.json",
  ])("%s", (name) => assertButtonStatusBody(bodyOf(name)));
});

describe("facts about the API", () => {
  it("calendar 1 activities have many sessions; calendar 3 sessions are each their own activity", () => {
    const ids = (name: string) =>
      fixture<Envelope<EventsBody>>(name).body.center_events[0].events.map((e) => e.event_item_id);
    const dropIn = ids("events.1.json");
    const enroll = ids("events.3.json");
    expect(new Set(dropIn).size).toBeLessThan(dropIn.length);
    expect(new Set(enroll).size).toBe(enroll.length);
  });

  it("calendar 3 detail covers a single day; calendar 1 detail covers the whole run", () => {
    const d3 = (
      bodyOf("detail.3.open.json") as { detail: { first_date: string; last_date: string } }
    ).detail;
    const d1 = (bodyOf("detail.1.json") as { detail: { first_date: string; last_date: string } })
      .detail;
    expect(d3.first_date).toBe(d3.last_date);
    expect(d1.first_date < d1.last_date).toBe(true);
  });

  it("space_status is 'Full' or 'N openings remaining'", () => {
    const space = (name: string) =>
      (bodyOf(name) as { detail: { space_status: string } }).detail.space_status;
    expect(space("detail.3.full.json")).toBe("Full");
    expect(space("detail.3.open.json")).toMatch(/^\d+ openings? remaining$/);
  });

  it("enrollment open now: an enroll link and an empty opening time", () => {
    const s = status("buttonstatus.3.enroll.json");
    expect(s.action_link?.href).toMatch(
      /^https:\/\/[^/]+\.activecommunities\.com\/.+\/enroll\/\d+/,
    );
    expect(s.activity_online_start_time).toBe("");
    expect(s.notification).toBe("");
  });

  it("enrollment opens later: the link is already present with a future opening time", () => {
    const s = status("buttonstatus.3.opens.json");
    expect(s.action_link?.href).toContain(`/enroll/${capture.enroll.opens.activityId}`);
    expect(s.activity_online_start_time > capture.capturedAt).toBe(true);
    expect(s.activity_online_start_time < capture.enroll.opens.start).toBe(true);
  });

  it("full: no link, and an HTML notice that says full", () => {
    const s = status("buttonstatus.3.full.json");
    expect(s.action_link).toBeNull();
    expect(s.notification).toMatch(/<div>.*\bfull\b/i);
  });

  it("drop-ins can't be enrolled in online", () => {
    const s = status("buttonstatus.1.json");
    expect(s.action_link).toBeNull();
    expect(s.notification).toMatch(/registration is not available/i);
  });
});
