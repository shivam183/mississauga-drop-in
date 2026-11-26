import { describe, expect, it } from "vitest";
import type { MeetingDatesBody } from "@/lib/activenet/types";
import {
  cityDates,
  cityWeekdays,
  icsFileName,
  patternEvent,
  reminderEvent,
  toIcs,
  type CalendarEvent,
} from "@/models/calendar";
import { calendarPatterns } from "@/models/registered";
import meetingDates from "../fixtures/meetingdates.json";

const NOW = new Date("2026-11-26T15:00:00Z");
const BASE = {
  title: "Swim, Level 1",
  location: "Malton CC",
  url: "https://example.ca/a",
  page: "/registered/1",
};

describe("calendar", () => {
  it("reads the City's weekdays, or gives up on anything unknown", () => {
    expect(cityWeekdays("Sat")).toEqual(["SA"]);
    expect(cityWeekdays("Mon, Tue, Wed")).toEqual(["MO", "TU", "WE"]);
    expect(cityWeekdays("Weekdays")).toEqual(["MO", "TU", "WE", "TH", "FR"]);
    expect(cityWeekdays("1st Mon")).toBeNull();
    expect(cityWeekdays("")).toBeNull();
  });

  it("reads the City's exception dates, single or grouped", () => {
    expect(cityDates("25 Dec 2026")).toEqual(["2026-12-25"]);
    expect(cityDates("24,30,31 Dec 2026")).toEqual(["2026-12-24", "2026-12-30", "2026-12-31"]);
    expect(cityDates("Christmas")).toEqual([]);
  });

  it("starts a pattern at its first meeting day that isn't skipped", () => {
    // 2026-12-21 is a Monday; Wednesdays only, and the 23rd is skipped.
    const pattern = {
      days: ["WE"],
      from: "2026-12-21",
      until: "2027-01-27",
      start: "18:00:00",
      end: "19:00:00",
      except: ["2026-12-23"],
    };
    const event = patternEvent(pattern, BASE, "u")!;
    expect(event.start).toBe("2026-12-30 18:00:00");
    expect(event.weekly).toEqual({ days: ["WE"], until: "2027-01-27", except: ["2026-12-23"] });
    // A one-off date doesn't repeat; a range with no matching day never meets.
    expect(
      patternEvent({ ...pattern, from: "2026-12-30", until: "2026-12-30" }, BASE, "u")!.weekly,
    ).toBeUndefined();
    expect(
      patternEvent({ ...pattern, from: "2026-12-21", until: "2026-12-22" }, BASE, "u"),
    ).toBeNull();
  });

  it("writes a valid weekly event in Toronto time, with holidays skipped", () => {
    const event: CalendarEvent = {
      uid: "program-1-0@mississaugadropin.com",
      ...BASE,
      start: "2026-12-30 18:00:00",
      end: "2026-12-30 19:00:00",
      weekly: { days: ["MO", "WE"], until: "2027-03-10", except: ["2027-01-18"] },
    };
    const ics = toIcs([event], NOW);
    const lines = ics.split("\r\n");
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(lines).toContain("TZID:America/Toronto");
    expect(lines).toContain("DTSTART;TZID=America/Toronto:20261230T180000");
    expect(lines).toContain("DTEND;TZID=America/Toronto:20261230T190000");
    // UNTIL is UTC, and late enough to include an evening class on the last day.
    expect(lines).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20270311T050000Z");
    expect(lines).toContain("EXDATE;TZID=America/Toronto:20270118T180000");
    expect(lines).toContain("SUMMARY:Swim\\, Level 1");
    expect(lines).toContain("DTSTAMP:20261126T150000Z");
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
    // The notes: the City's page, a blank line, then this site's page and the coffee link.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(
      "DESCRIPTION:Details and registration: https://example.ca/a\\n\\n" +
        "Found on mississaugadropin.com: https://mississaugadropin.com/registered/1\\n" +
        "Saved you a trip? Buy me a coffee: https://buymeacoffee.com/shivam183\r\n",
    );
  });

  it("folds long lines at 75 bytes", () => {
    const event: CalendarEvent = {
      uid: "x",
      ...BASE,
      title: "é".repeat(100),
      start: "2026-12-30 18:00:00",
      end: "2026-12-30 19:00:00",
    };
    const lines = toIcs([event], NOW).split("\r\n");
    for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const summary = lines.findIndex((l) => l.startsWith("SUMMARY:"));
    const unfolded = [lines[summary], ...lines.slice(summary + 1).filter((l) => l.startsWith(" "))]
      .map((l, i) => (i ? l.slice(1) : l))
      .join("");
    expect(unfolded.startsWith(`SUMMARY:${"é".repeat(100)}`)).toBe(true);
  });

  it("reminds you when registration opens: 15 minutes, an alert 10 before, the enroll link", () => {
    const event = reminderEvent(
      { name: "Swim Kids 3", location: "Malton CC", page: "/registered/7" },
      "2026-11-30 23:50:00",
      "https://example.ca/enroll/7",
      "reminder-program-7@mississaugadropin.com",
    );
    // Crosses midnight (and the month) without a zone shift: wall-clock minutes.
    expect([event.start, event.end]).toEqual(["2026-11-30 23:50:00", "2026-12-01 00:05:00"]);
    const lines = toIcs([event], NOW).replace(/\r\n /g, "").split("\r\n");
    expect(lines).toContain("SUMMARY:Registration opens: Swim Kids 3");
    expect(lines).toContain("URL:https://example.ca/enroll/7");
    const alarm = lines.slice(lines.indexOf("BEGIN:VALARM"), lines.indexOf("END:VALARM") + 1);
    expect(alarm).toEqual([
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Registration opens: Swim Kids 3",
      "TRIGGER:-PT10M",
      "END:VALARM",
    ]);
    // Ordinary events have no alert.
    expect(toIcs([{ ...event, alertMinutes: undefined }], NOW)).not.toContain("VALARM");
  });

  it("names the file after the title", () => {
    expect(icsFileName("Lane & Leisure Swim")).toBe("lane-leisure-swim.ics");
    expect(icsFileName("®")).toBe("event.ics");
  });

  it("turns the City's meeting dates into patterns, with extra dates as one-offs", () => {
    expect(calendarPatterns((meetingDates as unknown as { body: MeetingDatesBody }).body)).toEqual([
      {
        days: ["SA"],
        from: "2026-09-26",
        until: "2026-12-12",
        start: "08:30:00",
        end: "09:00:00",
        except: [],
      },
    ]);
    const body = {
      meeting_and_registration_dates: {
        activity_patterns: [
          {
            beginning_date: "2026-12-21",
            ending_date: "2027-01-22",
            exception_dates: ["24,30,31 Dec 2026"],
            pattern_dates: [
              { weekdays: "Mon, Tue, Wed", starting_time: "07:30:00", ending_time: "18:00:00" },
              { weekdays: "1st Mon", starting_time: "07:30:00", ending_time: "18:00:00" },
            ],
          },
        ],
        additional_dates: [
          { meeting_date: "2026-12-30", starting_time: "18:00:00", ending_time: "23:30:00" },
        ],
      },
    } as MeetingDatesBody;
    const [weekly, extra, ...rest] = calendarPatterns(body);
    expect(rest).toEqual([]);
    expect(weekly.days).toEqual(["MO", "TU", "WE"]);
    expect(weekly.except).toEqual(["2026-12-24", "2026-12-30", "2026-12-31"]);
    expect(extra).toEqual({
      days: ["WE"],
      from: "2026-12-30",
      until: "2026-12-30",
      start: "18:00:00",
      end: "23:30:00",
      except: [],
    });
  });
});
