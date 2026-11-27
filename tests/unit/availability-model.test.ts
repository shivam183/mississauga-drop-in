import { describe, expect, it } from "vitest";
import type { ActivityDetailBody, ButtonStatusBody, Envelope } from "@/lib/activenet/types";
import {
  parseSpaces,
  toEnrollState,
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
  it("open for enrollment now", () => {
    const status = toSessionStatus(
      166860,
      detail("detail.3.open.json"),
      button("buttonstatus.3.enroll.json"),
      checkedAt,
    );
    expect(status).toEqual({
      activityId: 166860,
      spaces: { level: "open", count: 8 },
      enrollUrl: expect.stringMatching(
        /^https:\/\/anc\.ca\.apm\.activecommunities\.com\/.+\/enroll\/166860/,
      ),
      opensAt: null,
      notice: "",
      phone: "905-615-4640", // Malton's own line
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
    expect(status.enrollUrl).toBeNull();
    expect(status.notice).toBe(
      "This activity is full and is not able to accept any more enrollments.",
    );
  });

  it("opens later", () => {
    const status = toSessionStatus(164373, null, button("buttonstatus.3.opens.json"), checkedAt);
    expect(status.opensAt).toBe("2026-12-30 07:00:00");
    expect(status.spaces.level).toBe("unknown");
  });

  it("drops an enroll link that isn't the City's", () => {
    const evil = structuredClone(button("buttonstatus.3.enroll.json"));
    evil.button_status.action_link!.href = "https://evil.example/enroll";
    expect(toSessionStatus(1, null, evil, checkedAt).enrollUrl).toBeNull();
  });
});

describe("toEnrollState", () => {
  const base: SessionStatus = {
    activityId: 1,
    spaces: { level: "open", count: 8 },
    enrollUrl:
      "https://anc.ca.apm.activecommunities.com/activemississauga/activity/search/enroll/1",
    opensAt: null,
    notice: "",
    checkedAt: "2026-11-14T20:00:00.000Z",
  };
  const now = "2026-11-14 15:00:00";

  it("enroll: link and no opening time", () => {
    expect(toEnrollState(base, now)).toEqual({ state: "enroll", url: base.enrollUrl });
  });

  it("opens: before the opening time, then enroll once it has passed", () => {
    const status = { ...base, opensAt: "2026-12-30 07:00:00" };
    expect(toEnrollState(status, "2026-12-30 06:59:59")).toEqual({
      state: "opens",
      opensAt: "2026-12-30 07:00:00",
      url: base.enrollUrl,
    });
    expect(toEnrollState(status, "2026-12-30 07:00:00")).toEqual({
      state: "enroll",
      url: base.enrollUrl,
    });
  });

  it("full: from the count, or from the notice even with a link", () => {
    expect(toEnrollState({ ...base, spaces: { level: "full", count: 0 } }, now)).toEqual({
      state: "full",
    });
    expect(
      toEnrollState({ ...base, notice: "This activity is full and is not able…" }, now),
    ).toEqual({
      state: "full",
    });
  });

  it("closed: another notice and no link", () => {
    const other = "Registration for this activity is closed.";
    expect(toEnrollState({ ...base, enrollUrl: null, notice: other }, now)).toEqual({
      state: "closed",
      message: other,
    });
  });

  it("a started session with spots left suggests a walk-in; otherwise the City's words", () => {
    const over =
      "We're sorry, but this activity is over. The last meeting was Saturday, November 14, 2026.";
    expect(toEnrollState({ ...base, enrollUrl: null, notice: over }, now)).toEqual({
      state: "walk-in",
    });
    const phone = "(905) 615-4100";
    expect(toEnrollState({ ...base, phone, enrollUrl: null, notice: over }, now)).toEqual({
      state: "walk-in",
      phone,
    });
    const full = { level: "full", count: 0 } as const;
    expect(toEnrollState({ ...base, spaces: full, enrollUrl: null, notice: over }, now)).toEqual({
      state: "full",
    });
    const unknown = { level: "unknown", text: null } as const;
    expect(toEnrollState({ ...base, spaces: unknown, enrollUrl: null, notice: over }, now)).toEqual(
      { state: "closed", message: over },
    );
  });

  it("unknown: lookup failed, or nothing to go on", () => {
    expect(toEnrollState(null, now)).toEqual({ state: "unknown" });
    expect(toEnrollState({ ...base, enrollUrl: null }, now)).toEqual({ state: "unknown" });
  });

  it("the recorded responses map to the expected states", () => {
    const at = (d: string | null, b: string) =>
      toSessionStatus(1, d ? detail(d) : null, button(b), checkedAt);
    expect(toEnrollState(at("detail.3.open.json", "buttonstatus.3.enroll.json"), now).state).toBe(
      "enroll",
    );
    expect(toEnrollState(at("detail.3.full.json", "buttonstatus.3.full.json"), now).state).toBe(
      "full",
    );
    expect(toEnrollState(at(null, "buttonstatus.3.opens.json"), now).state).toBe("opens");
    expect(toEnrollState(at("detail.1.json", "buttonstatus.1.json"), now).state).toBe("closed");
  });
});
