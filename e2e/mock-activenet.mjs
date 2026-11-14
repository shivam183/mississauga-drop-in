// A stand-in for the City's ActiveNet API, serving the recorded responses in
// tests/fixtures/ so end-to-end tests are deterministic and never call the
// City. Session dates are moved so the first one is tomorrow.
//
// For calendar 3 (enrol online), sessions sorted by start get:
//   #0  open for enrolment; spots go down by one on every detail request
//   #1  full
//   #2+ open, with enrolment opening at 7 am the day before
//
//   node e2e/mock-activenet.mjs [port]   (default 3101)
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.argv[2] ?? process.env.MOCK_ACTIVENET_PORT ?? 3101);
const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../tests/fixtures");
const fixture = (name) => JSON.parse(readFileSync(path.join(FIXTURES, name), "utf8"));

const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Toronto" }).format(new Date());
const dayNumber = (date) =>
  Date.UTC(...date.split("-").map((n, i) => Number(n) - (i === 1 ? 1 : 0))) / 864e5;
const shiftDay = (date, days) =>
  new Date((dayNumber(date) + days) * 864e5).toISOString().slice(0, 10);

/** Moves every session so the earliest starts tomorrow. */
function shifted(name) {
  const envelope = fixture(name);
  const events = envelope.body.center_events.flatMap((c) => c.events);
  const earliest = events.map((e) => e.start_time.slice(0, 10)).sort()[0];
  const offset = dayNumber(today) + 1 - dayNumber(earliest);
  for (const e of events) {
    e.start_time = `${shiftDay(e.start_time.slice(0, 10), offset)}${e.start_time.slice(10)}`;
    e.end_time = `${shiftDay(e.end_time.slice(0, 10), offset)}${e.end_time.slice(10)}`;
  }
  return envelope;
}

const events = { 1: shifted("events.1.json"), 3: shifted("events.3.json") };
const enrolSessions = events[3].body.center_events
  .flatMap((c) => c.events)
  .sort((a, b) => a.start_time.localeCompare(b.start_time));
const enrolIndex = new Map(enrolSessions.map((e, i) => [e.event_item_id, i]));
const centreIds = (calendar) =>
  new Set(events[calendar].body.center_events.map((c) => c.center_id));

let openSpots = 9;

function detail(id) {
  const index = enrolIndex.get(id);
  const envelope = fixture(
    index === 1
      ? "detail.3.full.json"
      : index === undefined
        ? "detail.1.json"
        : "detail.3.open.json",
  );
  envelope.body.detail.activity_id = id;
  if (index === 0) {
    openSpots = Math.max(1, openSpots - 1);
    envelope.body.detail.space_status = `${openSpots} openings remaining`;
  } else if (index !== undefined && index > 1) {
    envelope.body.detail.space_status = "15 openings remaining";
  }
  return envelope;
}

function buttonStatus(id) {
  const index = enrolIndex.get(id);
  if (index === undefined) return fixture("buttonstatus.1.json");
  if (index === 1) return fixture("buttonstatus.3.full.json");
  const envelope = fixture(index === 0 ? "buttonstatus.3.enrol.json" : "buttonstatus.3.opens.json");
  const status = envelope.body.button_status;
  status.action_link.href = status.action_link.href.replace(/enroll\/\d+/, `enroll/${id}`);
  if (index > 0) {
    status.activity_online_start_time = `${shiftDay(enrolSessions[index].start_time.slice(0, 10), -1)} 07:00:00`;
  }
  return envelope;
}

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    const send = (status, json) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(json));
    };
    const id = Number(url.pathname.match(/\/(\d+)$/)?.[1]);

    if (url.pathname.endsWith("/onlinecalendar/filters")) {
      return send(200, fixture(`filters.${JSON.parse(body).calendar_id}.json`));
    }
    if (url.pathname.endsWith("/onlinecalendar/multicenter/events")) {
      const query = JSON.parse(body);
      const wanted = query.center_ids.filter((c) => centreIds(query.calendar_id).has(c));
      const envelope = structuredClone(events[query.calendar_id]);
      envelope.body.center_events = envelope.body.center_events.filter((c) =>
        wanted.includes(c.center_id),
      );
      return send(200, envelope);
    }
    if (url.pathname.includes("/activity/detail/buttonstatus/") && id)
      return send(200, buttonStatus(id));
    if (url.pathname.includes("/activity/detail/") && id) return send(200, detail(id));
    send(404, { headers: { response_code: "9999", response_message: "Not found" }, body: {} });
  });
});

server.listen(PORT, () => console.log(`Mock ActiveNet listening on http://localhost:${PORT}`));
