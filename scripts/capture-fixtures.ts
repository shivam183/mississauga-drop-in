/**
 * Records real ActiveNet responses into tests/fixtures/ so tests never call
 * the live API. Large responses are trimmed. About 15–25 throttled requests.
 *
 *   npm run capture-fixtures
 *
 * Writes:
 *   filters.{1,3}.json        centre lists (other filter lists cut to 3 items)
 *   events.{1,3}.json         one centre's sessions, trimmed
 *   detail.1.json             a calendar 1 activity (count covers all its sessions)
 *   detail.3.open.json        a calendar 3 session with openings
 *   detail.3.full.json        a calendar 3 session that is full
 *   buttonstatus.1.json       "Online registration is not available…"
 *   buttonstatus.3.enroll.json enrollment open now
 *   buttonstatus.3.opens.json enrollment opens in the future
 *   buttonstatus.3.full.json  "This activity is full…"
 *   buttonstatus.3.over.json  "…this activity is over" (only if one ended today)
 *   activities.filters.json   the activity search's lists (centres, categories, seasons cut to 5)
 *   activities.list.json      one page of a "swim" program search, cut to 8 rows
 *   estimateprice.json        the first of those programs' fees
 *   meetingdates.json         and when it meets
 *   capture.json              when and from which sessions the above came
 */
import path from "node:path";
import { activeNetClientFromEnv } from "../src/lib/activenet/client";
import type { RawCentre, RawEvent } from "../src/lib/activenet/types";
import { TORONTO_TIME_ZONE, toTorontoLocal } from "../src/lib/dates";
import { EMPTY_PROGRAM_SEARCH, programTypeIds, toSearchPattern } from "../src/models/registered";
import { run, writeJson } from "./lib";

const OUT = path.resolve("tests/fixtures");
const MAX_STATUS_LOOKUPS = 15;

/** Keeps the raw envelope of the latest response for each URL. */
const raw = new Map<string, Record<string, unknown>>();
const recordingFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const text = await response.clone().text();
  try {
    raw.set(String(input), JSON.parse(text));
  } catch {
    // Not JSON: the client reports it.
  }
  return response;
};
const lastEnvelope = (urlPart: string) => {
  const entries = [...raw.entries()].filter(([url]) => url.includes(urlPart));
  if (entries.length === 0) throw new Error(`no recorded response for ${urlPart}`);
  return structuredClone(entries.at(-1)![1]) as { headers: unknown; body: Record<string, unknown> };
};

const client = activeNetClientFromEnv(process.env, { fetch: recordingFetch });

function trimEvents(envelope: { body: Record<string, unknown> }, keep: number) {
  const centres = envelope.body.center_events as Array<{ total: number; events: RawEvent[] }>;
  for (const centre of centres) {
    centre.events = centre.events
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .slice(0, keep);
    centre.total = centre.events.length;
  }
  return envelope;
}

run(async () => {
  const now = toTorontoLocal(new Date());
  const manifest: Record<string, unknown> = { capturedAt: now, timeZone: TORONTO_TIME_ZONE };

  // Filters (both calendars share one URL, so save each right after its request).
  const centres: Record<number, RawCentre[]> = {};
  for (const calendar of [1, 3] as const) {
    centres[calendar] = (await client.getFilters(calendar)).center;
    const envelope = lastEnvelope("/filters");
    for (const [key, value] of Object.entries(envelope.body)) {
      if (key !== "center" && Array.isArray(value)) envelope.body[key] = value.slice(0, 3);
    }
    await writeJson(`${OUT}/filters.${calendar}.json`, envelope);
  }
  const dropInCentre = centres[1][0];
  const enrollCentres = centres[3];

  // Calendar 1: one centre's sessions, and one activity with many sessions.
  const dropIn = await client.getEvents(1, [dropInCentre.id]);
  await writeJson(`${OUT}/events.1.json`, trimEvents(lastEnvelope("/multicenter/events"), 40));
  const counts = new Map<number, number>();
  for (const e of dropIn.center_events.flatMap((c) => c.events)) {
    counts.set(e.event_item_id, (counts.get(e.event_item_id) ?? 0) + 1);
  }
  const busiest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const busiestNext = dropIn.center_events
    .flatMap((c) => c.events)
    .filter((e) => e.event_item_id === busiest[0] && e.start_time > now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
  await client.getActivityDetail(busiest[0]);
  await writeJson(`${OUT}/detail.1.json`, lastEnvelope(`/activity/detail/${busiest[0]}`));
  if (busiestNext) {
    await client.getButtonStatus(busiest[0], busiestNext.start_time);
    await writeJson(`${OUT}/buttonstatus.1.json`, lastEnvelope(`/buttonstatus/${busiest[0]}`));
  }
  manifest.dropIn = { centreId: dropInCentre.id, activityId: busiest[0], sessions: busiest[1] };

  // Calendar 3: all centres (one ~0.7 MB request), fixture keeps one centre.
  const enroll = await client.getEvents(
    3,
    enrollCentres.map((c) => c.id),
  );
  const envelope3 = lastEnvelope("/multicenter/events");
  envelope3.body.center_events = (envelope3.body.center_events as unknown[]).slice(0, 1);
  await writeJson(`${OUT}/events.3.json`, trimEvents(envelope3, 30));

  const sessions = enroll.center_events
    .flatMap((c) => c.events)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const upcoming = sessions.filter((e) => e.start_time > now);
  const found: Record<string, RawEvent> = {};
  const save = async (name: string, session: RawEvent, withDetail?: string) => {
    found[name] = session;
    await writeJson(
      `${OUT}/buttonstatus.3.${name}.json`,
      lastEnvelope(`/buttonstatus/${session.event_item_id}`),
    );
    if (withDetail) {
      await client.getActivityDetail(session.event_item_id);
      await writeJson(
        `${OUT}/detail.3.${withDetail}.json`,
        lastEnvelope(`/activity/detail/${session.event_item_id}?`),
      );
    }
  };

  // Furthest session: enrollment usually opens the day before, so it's in the future.
  const last = upcoming.at(-1);
  if (last) {
    const { button_status: s } = await client.getButtonStatus(last.event_item_id, last.start_time);
    if (s.action_link && s.activity_online_start_time > now) await save("opens", last);
  }

  // Soonest sessions: look for one open for enrollment and one full.
  let lookups = 0;
  for (const session of upcoming) {
    if ((found.enroll && found.full) || lookups >= MAX_STATUS_LOOKUPS) break;
    lookups++;
    const { button_status: s } = await client.getButtonStatus(
      session.event_item_id,
      session.start_time,
    );
    const isFull = /\bfull\b/i.test(s.notification);
    if (isFull && !found.full) await save("full", session, "full");
    else if (!isFull && s.action_link && s.activity_online_start_time <= now && !found.enroll) {
      await save("enroll", session, "open");
    }
  }

  // A session that ended earlier today.
  const today = now.slice(0, 10);
  const ended = sessions.filter((e) => e.start_time.startsWith(today) && e.end_time <= now).at(-1);
  if (ended) {
    const { button_status: s } = await client.getButtonStatus(
      ended.event_item_id,
      ended.start_time,
    );
    if (/\bover\b/i.test(s.notification)) await save("over", ended);
  }

  // Registered programs (/registered): filter lists, one search page, one program's fees and dates.
  const options = await client.getActivityFilters();
  const filtersEnvelope = lastEnvelope("/activities/filters");
  for (const key of ["centers", "categories", "seasons"]) {
    const list = filtersEnvelope.body[key];
    if (Array.isArray(list)) filtersEnvelope.body[key] = list.slice(0, 5);
  }
  await writeJson(`${OUT}/activities.filters.json`, filtersEnvelope);
  const programs = await client.searchActivities(
    {
      ...toSearchPattern({ ...EMPTY_PROGRAM_SEARCH, q: "swim" }, programTypeIds(options.types)),
    },
    1,
  );
  const listEnvelope = lastEnvelope("/activities/list");
  listEnvelope.body.activity_items = (listEnvelope.body.activity_items as unknown[]).slice(0, 8);
  await writeJson(`${OUT}/activities.list.json`, listEnvelope);
  const program = programs.items[0];
  if (program) {
    await client.getEstimatePrice(program.id);
    await writeJson(`${OUT}/estimateprice.json`, lastEnvelope(`/estimateprice/${program.id}`));
    await client.getMeetingDates(program.id);
    await writeJson(
      `${OUT}/meetingdates.json`,
      lastEnvelope(`/meetingandregistrationdates/${program.id}`),
    );
    manifest.program = { activityId: program.id, total: programs.total };
  }

  manifest.enroll = Object.fromEntries(
    Object.entries(found).map(([k, e]) => [
      k,
      { activityId: e.event_item_id, start: e.start_time },
    ]),
  );
  await writeJson(`${OUT}/capture.json`, manifest);

  const missing = ["opens", "enroll", "full"].filter((k) => !found[k]);
  console.log(
    `Captured ${raw.size} responses into tests/fixtures (${Object.keys(found).join(", ")}).`,
  );
  if (missing.length > 0) {
    console.warn(`Not found this run: ${missing.join(", ")}. Older fixtures for these were kept.`);
  }
});
