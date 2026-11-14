import { describe, expect, it } from "vitest";
import type { ActivityDetailBody, ButtonStatusBody, Envelope } from "@/lib/activenet/types";
import {
  parseSpaces,
  toEnrolState,
  toSessionStatus,
  type SessionStatus,
} from "@/models/availability";
import { fixture } from "./fixtures";

const detail = (name: string) => fixture<Envelope<ActivityDetailBody>>(name).body;
const button = (name: string) => fixture<Envelope<ButtonStatusBody>>(name).body;
const checkedAt = new Date("2026-11-14T20:21:58Z");

describe("parseSpaces", () => {
  it.each([
    ["Full", { level: "full", count: 0 }],
    ["full", { level: "full", count: 0 }],
    ["0 openings remaining", { level: "full", count: 0 }],
    ["1 opening remaining", { level: "few", count: 1 }],
    ["5 openings remaining", { level: "few", count: 5 }],
    ["6 openings remaining", { level: "open", count: 6 }],
    ["24 openings remaining", { level: "open", count: 24 }],
    [" 8 openings remaining ", { level: "open", count: 8 }],
  ])("%j", (text, expected) => {
    expect(parseSpaces(text)).toEqual(expected);
  });

  it.each([["Waitlist available"], [""], [null], [undefined]])("unknown wording %j", (text) => {
    expect(parseSpaces(text)).toEqual({ level: "unknown", text: text?.trim() ?? null });
  });
});

describe("toSessionStatus with recorded responses", () => {
  it("open for enrolment now", () => {
    const status = toSessionStatus(
      166860,
      detail("detail.3.open.json"),
      button("buttonstatus.3.enrol.json"),
      checkedAt,
    );
    expect(status).toEqual({
      activityId: 166860,
      spaces: { level: "open", count: 8 },
      enrolUrl: expect.stringMatching(
        /^https:\/\/anc\.ca\.apm\.activecommunities\.com\/.+\/enroll\/166860/,
      ),
      opensAt: null,
      notice: "",
      checkedAt: "2026-11-14T20:21:58.000Z",
    });
  });

  it("full, with the HTML notice turned into text", () => {
    const status = toSessionStatus(
      164542,
      detail("detail.3.full.json"),
      button("buttonstatus.3.full.json"),
      checkedAt,
    );
    expect(status.spaces).toEqual({ level: "full", count: 0 });
    expect(status.enrolUrl).toBeNull();
    expect(status.notice).toBe(
      "This activity is full and is not able to accept any more enrollments.",
    );
  });

  it("opens later", () => {
    const status = toSessionStatus(164373, null, button("buttonstatus.3.opens.json"), checkedAt);
    expect(status.opensAt).toBe("2026-12-30 07:00:00");
    expect(status.spaces.level).toBe("unknown");
  });

  it("drops an enrol link that isn't the City's", () => {
    const evil = structuredClone(button("buttonstatus.3.enrol.json"));
    evil.button_status.action_link!.href = "https://evil.example/enroll";
    expect(toSessionStatus(1, null, evil, checkedAt).enrolUrl).toBeNull();
  });
});

describe("toEnrolState", () => {
  const base: SessionStatus = {
    activityId: 1,
    spaces: { level: "open", count: 8 },
    enrolUrl: "https://anc.ca.apm.activecommunities.com/activemississauga/activity/search/enroll/1",
    opensAt: null,
    notice: "",
    checkedAt: "2026-11-14T20:00:00.000Z",
  };
  const now = "2026-11-14 15:00:00";

  it("enrol: link and no opening time", () => {
    expect(toEnrolState(base, now)).toEqual({ state: "enrol", url: base.enrolUrl });
  });

  it("opens: before the opening time, then enrol once it has passed", () => {
    const status = { ...base, opensAt: "2026-12-30 07:00:00" };
    expect(toEnrolState(status, "2026-12-30 06:59:59")).toEqual({
      state: "opens",
      opensAt: "2026-12-30 07:00:00",
      url: base.enrolUrl,
    });
    expect(toEnrolState(status, "2026-12-30 07:00:00")).toEqual({
      state: "enrol",
      url: base.enrolUrl,
    });
  });

  it("full: from the count, or from the notice even with a link", () => {
    expect(toEnrolState({ ...base, spaces: { level: "full", count: 0 } }, now)).toEqual({
      state: "full",
    });
    expect(
      toEnrolState({ ...base, notice: "This activity is full and is not able…" }, now),
    ).toEqual({
      state: "full",
    });
  });

  it("closed: another notice and no link", () => {
    const message = "We're sorry, but this activity is over.";
    expect(toEnrolState({ ...base, enrolUrl: null, notice: message }, now)).toEqual({
      state: "closed",
      message,
    });
  });

  it("unknown: lookup failed, or nothing to go on", () => {
    expect(toEnrolState(null, now)).toEqual({ state: "unknown" });
    expect(toEnrolState({ ...base, enrolUrl: null }, now)).toEqual({ state: "unknown" });
  });

  it("the recorded responses map to the expected states", () => {
    const at = (d: string | null, b: string) =>
      toSessionStatus(1, d ? detail(d) : null, button(b), checkedAt);
    expect(toEnrolState(at("detail.3.open.json", "buttonstatus.3.enrol.json"), now).state).toBe(
      "enrol",
    );
    expect(toEnrolState(at("detail.3.full.json", "buttonstatus.3.full.json"), now).state).toBe(
      "full",
    );
    expect(toEnrolState(at(null, "buttonstatus.3.opens.json"), now).state).toBe("opens");
    expect(toEnrolState(at("detail.1.json", "buttonstatus.1.json"), now).state).toBe("closed");
  });
});
