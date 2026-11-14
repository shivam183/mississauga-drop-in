import { describe, expect, it } from "vitest";
import { toTorontoLocal } from "@/lib/dates";

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
