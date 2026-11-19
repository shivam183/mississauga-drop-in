import { expect, test } from "@playwright/test";

// The API doesn't depend on screen size, so run it in one project only.
test.skip(({ isMobile }) => isMobile, "API tests run once, in the desktop project");

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-0[45]:00$/;

test("GET /api/centres lists every centre with its session types", async ({ request }) => {
  const response = await request.get("/api/centres");
  expect(response.status()).toBe(200);
  expect(response.headers()["access-control-allow-origin"]).toBe("*");
  const { centres } = await response.json();
  expect(centres.length).toBeGreaterThan(10);
  expect(centres).toContainEqual({
    id: 290,
    name: "Burnhamthorpe Community Centre",
    types: ["dropin", "enroll"],
  });
  const names = centres.map((c: { name: string }) => c.name);
  expect(names).toEqual([...names].sort((a: string, b: string) => a.localeCompare(b, "en")));
});

test("GET /api/sessions returns upcoming sessions, soonest first, with ISO times", async ({
  request,
}) => {
  const response = await request.get("/api/sessions");
  expect(response.status()).toBe(200);
  expect(response.headers()["access-control-allow-origin"]).toBe("*");
  expect(response.headers()["cache-control"]).toContain("s-maxage=60");
  const body = await response.json();

  expect(body).toMatchObject({ offset: 0, limit: 50, failedCentres: [] });
  expect(body.total).toBeGreaterThan(body.sessions.length);
  expect(body.sessions).toHaveLength(50);
  const first = body.sessions[0];
  expect(Object.keys(first).sort()).toEqual(
    ["activityId", "centre", "end", "facility", "id", "start", "title", "type", "url"].sort(),
  );
  expect(first.start).toMatch(ISO_WITH_OFFSET);
  expect(first.end).toMatch(ISO_WITH_OFFSET);
  expect(first.centre).toEqual({ id: 290, name: "Burnhamthorpe Community Centre" });
  const starts = body.sessions.map((s: { start: string }) => Date.parse(s.start));
  expect(starts).toEqual([...starts].sort((a, b) => a - b));
  expect(Date.parse(body.sessions.at(-1).end)).toBeGreaterThan(Date.now());
});

test("GET /api/sessions pages with limit, offset and next", async ({ request }) => {
  const all = await (await request.get("/api/sessions?limit=200")).json();
  const page1 = await (await request.get("/api/sessions?limit=5")).json();
  expect(page1.sessions.map((s: { id: string }) => s.id)).toEqual(
    all.sessions.slice(0, 5).map((s: { id: string }) => s.id),
  );
  expect(page1.next).toBe("/api/sessions?limit=5&offset=5");

  const page2 = await (await request.get(page1.next)).json();
  expect(page2.offset).toBe(5);
  expect(page2.sessions.map((s: { id: string }) => s.id)).toEqual(
    all.sessions.slice(5, 10).map((s: { id: string }) => s.id),
  );

  const past = await (await request.get(`/api/sessions?offset=${all.total}`)).json();
  expect(past.sessions).toEqual([]);
  expect(past.next).toBeNull();
});

test("GET /api/sessions filters like the site", async ({ request }) => {
  const enroll = await (await request.get("/api/sessions?type=enroll&limit=200")).json();
  expect(enroll.total).toBeGreaterThan(0);
  expect(enroll.sessions.every((s: { type: string }) => s.type === "enroll")).toBe(true);

  const swim = await (await request.get("/api/sessions?q=swim&time=morning&limit=200")).json();
  for (const s of swim.sessions) {
    expect(s.title.toLowerCase() + s.facility.toLowerCase()).toMatch(/swim|pool/);
    expect(Number(s.start.slice(11, 13))).toBeLessThan(12);
  }

  const none = await (await request.get("/api/sessions?centre=119")).json(); // not in the mock
  expect(none.total).toBe(0);
});

test("GET /api/sessions rejects bad paging", async ({ request }) => {
  for (const query of ["limit=0", "limit=201", "limit=x", "offset=-1"]) {
    const response = await request.get(`/api/sessions?${query}`);
    expect(response.status(), query).toBe(400);
    expect((await response.json()).error).toBeTruthy();
  }
});

test("GET /api/availability includes the worked-out enroll state", async ({ request }) => {
  const enroll = await (await request.get("/api/sessions?type=enroll&limit=3")).json();
  const ids = enroll.sessions.map((s: { activityId: number }) => s.activityId);
  const response = await request.get(`/api/availability?ids=${ids.join(",")}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["access-control-allow-origin"]).toBe("*");
  const body = await response.json();
  expect(Object.keys(body.statuses).map(Number).sort()).toEqual([...ids].sort());
  expect(body.enroll[ids[0]]).toMatchObject({
    state: "enroll",
    url: expect.stringContaining("/enroll/"),
  });
  expect(body.enroll[ids[1]]).toEqual({ state: "full" });
  for (const state of Object.values(body.enroll) as Array<{ state: string; opensAt?: string }>) {
    if (state.state === "opens") expect(state.opensAt).toMatch(ISO_WITH_OFFSET);
  }

  expect((await request.get("/api/availability")).status()).toBe(400);
  expect((await request.get("/api/availability?ids=1,2,x")).status()).toBe(400);
});

test("GET /api/programs lists registered programs with their status", async ({ request }) => {
  const response = await request.get("/api/programs");
  expect(response.status()).toBe(200);
  expect(response.headers()["access-control-allow-origin"]).toBe("*");
  const body = await response.json();
  expect(body).toMatchObject({ total: 8, page: 1, perPage: 20, next: null });
  const [open, full, opens] = body.programs;
  expect(open).toMatchObject({
    id: 158821,
    name: "H3O Swim For Life 1",
    location: "Frank McKechnie Cmty Centre",
    status: { state: "open", spots: 12 },
    enrollUrl: expect.stringContaining("/enroll/158821"),
  });
  expect(full.status).toEqual({ state: "full" });
  expect(opens.status).toMatchObject({
    state: "opens",
    opensAt: expect.stringMatching(ISO_WITH_OFFSET),
  });

  const swim2 = await (await request.get("/api/programs?q=life%202")).json();
  expect(swim2.programs.map((p: { id: number }) => p.id)).toEqual([161336]);

  const past = await (await request.get("/api/programs?page=2")).json();
  expect(past.programs).toEqual([]);
});

test("GET /api/programs rejects a bad page", async ({ request }) => {
  for (const query of ["page=0", "page=11", "page=x", "page=1.5"]) {
    const response = await request.get(`/api/programs?${query}`);
    expect(response.status(), query).toBe(400);
    expect((await response.json()).error).toBeTruthy();
  }
});

test("GET /api/programs/filters lists the locations, categories and seasons", async ({
  request,
}) => {
  const response = await request.get("/api/programs/filters");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(Object.keys(body)).toEqual(["locations", "categories", "seasons"]);
  expect(body.locations).toContainEqual({ id: 287, name: "Adamson Estate" });
  expect(body.categories[0]).toEqual({ id: expect.any(String), label: expect.any(String) });
});
