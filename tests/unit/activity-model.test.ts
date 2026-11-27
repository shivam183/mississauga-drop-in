import { describe, expect, it } from "vitest";
import type { ActivityDetailBody, Envelope } from "@/lib/activenet/types";
import { formatAges, NO_REGISTRATION, toActivityInfo } from "@/models/activity";
import { fixture } from "./fixtures";

const detail = (name: string) => fixture<Envelope<ActivityDetailBody>>(name).body.detail;

describe("toActivityInfo with recorded responses", () => {
  it("a drop-in (calendar 1)", () => {
    expect(toActivityInfo(detail("detail.1.json"))).toEqual({
      name: "Zumba®",
      category: "Fitness",
      ages: "14+",
      gender: "",
      season: "Fall 2026",
      firstDate: "2026-09-26",
      lastDate: "2027-01-02",
      description:
        "This fitness dance class combines Latin and international music with slow and fast paced moves. Enjoy this inspiring up beat workout.",
      notes: NO_REGISTRATION,
      centre: {
        name: "Burnhamthorpe Community Centre",
        address: "1500 Gulleden Drive, Mississauga, ON L4X 2T7",
        phone: "905-615-4630", // the centre's own line, not the City's (905) 615-4100
        lat: expect.any(Number),
        lng: expect.any(Number),
      },
      sessionCount: 39,
    });
  });

  it("an enroll-online session (calendar 3), open and full", () => {
    for (const name of ["detail.3.open.json", "detail.3.full.json"]) {
      const info = toActivityInfo(detail(name));
      expect(info.name).toBe("Adult Pickleball");
      expect(info.ages).toBe("18+");
      expect(info.centre?.address).toMatch(/, Mississauga, ON L\d[A-Z] \d[A-Z]\d$/);
      expect(info.sessionCount).toBe(1);
    }
  });
});

describe("toActivityInfo reads defensively", () => {
  const minimal = { activity_id: 1, activity_name: "Lane Swim", space_status: null };

  it("leaves out what's missing", () => {
    expect(toActivityInfo(minimal)).toEqual({
      name: "Lane Swim",
      category: "",
      ages: "",
      gender: "",
      season: "",
      firstDate: "",
      lastDate: "",
      description: "",
      notes: "",
      centre: null,
      sessionCount: null,
    });
  });

  it("shows a single-gender program and strips HTML from other notes", () => {
    const info = toActivityInfo({
      ...minimal,
      allowed_gender: "Female",
      online_notes: "<div>Bring a <b>lock</b> &amp; towel.</div>",
      catalog_description:
        '<div><span style="color: rgb(31, 73, 125);">Dance,&nbsp;music &amp; play.</span></div>',
      centers: [{ name: "Some Centre", latitude: 0, longitude: null }],
    });
    expect(info.gender).toBe("Female");
    expect(info.notes).toBe("Bring a lock & towel.");
    expect(info.description).toBe("Dance, music & play.");
    expect(info.centre).toEqual({
      name: "Some Centre",
      address: "",
      phone: "",
      lat: null,
      lng: null,
    });
  });

  it("says the drop-in boilerplate plainly but keeps anything the City adds", () => {
    const boilerplate =
      "This is a Drop-in Program for informational purposes only. <div>NO REGISTRATIONS are to be processed for this program.  Entry is on a first come-first serve basis on program capacity.    <div><font>.</font></div></div>";
    expect(toActivityInfo({ ...minimal, online_notes: boilerplate }).notes).toBe(NO_REGISTRATION);
    expect(
      toActivityInfo({
        ...minimal,
        online_notes: `${boilerplate} Bring a lock for the change room.`,
      }).notes,
    ).toBe(`${NO_REGISTRATION} Bring a lock for the change room.`);
    // The same note twice in a row works too (the regex is global).
    expect(toActivityInfo({ ...minimal, online_notes: boilerplate }).notes).toBe(NO_REGISTRATION);
  });

  it("uses user_notes when online_notes is empty", () => {
    expect(
      toActivityInfo({ ...minimal, online_notes: "", user_notes: "Wear runners." }).notes,
    ).toBe("Wear runners.");
  });
});

describe("formatAges", () => {
  it.each([
    ["16 yrs +,", "16+"],
    ["18 yrs +", "18+"],
    ["6 yrs - 12 yrs", "6–12"],
    ["6 - 12 yrs,", "6–12"],
    ["Age at least 18 yrs but less than 100 yrs", "18+"],
    ["Age at least 3 yrs but less than 5 yrs", "3–4"],
    ["Age at least 4y 9m but less than 15 yrs", "4y 9m–14"],
    ["Age at least 4&#189; yrs but less than 13 yrs,", "4½–12"],
    // The same program's details: "4y 6m" reads as the card's "4½".
    ["Age at least 4y 6m but less than 13 yrs,", "4½–12"],
    ["All ages", "All ages"],
    ["", ""],
    [null, ""],
  ])("%j -> %j", (input, expected) => {
    expect(formatAges(input)).toBe(expected);
  });
});
