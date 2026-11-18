import { describe, expect, it } from "vitest";
import { secondsUntilTorontoHour, toTorontoLocal } from "@/lib/dates";

describe("toTorontoLocal", () => {
  it("formats as the API's YYYY-MM-DD HH:mm:ss in Toronto time", () => {
    // 20:05:09 UTC is 15:05:09 EST (UTC-5) in November.
    expect(toTorontoLocal(new Date("2026-11-14T20:05:09Z"))).toBe("2026-11-14 15:05:09");
  });

  it("handles daylight saving time and midnight", () => {
    // EDT (UTC-4) in July; 04:00 UTC is midnight in Toronto.
    expect(toTorontoLocal(new Date("2026-07-01T04:00:00Z"))).toBe("2026-07-01 00:00:00");
  });
});

describe("secondsUntilTorontoHour", () => {
  it("counts to the next 7 am in Toronto, a full day when it's 7 now", () => {
    // November: Toronto is UTC-5.
    expect(secondsUntilTorontoHour(7, new Date("2026-11-18T11:00:00Z"))).toBe(3600);
    expect(secondsUntilTorontoHour(7, new Date("2026-11-18T12:00:00Z"))).toBe(86_400);
    expect(secondsUntilTorontoHour(7, new Date("2026-11-18T12:00:01Z"))).toBe(86_399);
    expect(secondsUntilTorontoHour(7, new Date("2026-11-19T04:30:00Z"))).toBe(27_000); // 11:30 pm
  });
});
