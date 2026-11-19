// A stand-in for the City's ActiveNet API, serving the recorded responses in
// tests/fixtures/ so end-to-end tests are deterministic and never call the
// City. Session dates are moved so the first one is tomorrow.
//
// For calendar 3 (enroll online), sessions sorted by start get:
//   #0  open for enrollment; spots go down by one on every detail request
//   #1  full
//   #2+ open, with enrollment opening at 7 am the day before
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
const enrollSessions = events[3].body.center_events
  .flatMap((c) => c.events)
  .sort((a, b) => a.start_time.localeCompare(b.start_time));
const enrollIndex = new Map(enrollSessions.map((e, i) => [e.event_item_id, i]));
const centreIds = (calendar) =>
  new Set(events[calendar].body.center_events.map((c) => c.center_id));

// High enough that a whole run of lookups never takes it into "few" (5 or fewer).
let openSpots = 50;

function detail(id) {
  const index = enrollIndex.get(id);
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
  const index = enrollIndex.get(id);
  if (index === undefined) return fixture("buttonstatus.1.json");
  if (index === 1) return fixture("buttonstatus.3.full.json");
  const envelope = fixture(
    index === 0 ? "buttonstatus.3.enroll.json" : "buttonstatus.3.opens.json",
  );
  const status = envelope.body.button_status;
  status.action_link.href = status.action_link.href.replace(/enroll\/\d+/, `enroll/${id}`);
  if (index > 0) {
    status.activity_online_start_time = `${shiftDay(enrollSessions[index].start_time.slice(0, 10), -1)} 07:00:00`;
  }
  return envelope;
}

// Registered programs (/registered): the recorded "swim" search. Row #0 is open
// with 12 spots, #1 full, #2 opens for registration tomorrow at 7 am, the rest
// as recorded (full).
const programs = fixture("activities.list.json").body.activity_items;
Object.assign(programs[0], { urgent_message: { status_description: "" }, total_open: 12 });
Object.assign(programs[2], {
  urgent_message: { status_description: "" },
  activity_online_start_time: `${shiftDay(today, 1)} 07:00:00`,
});
const programById = new Map(programs.map((p) => [p.id, p]));
const isFull = (p) => p.urgent_message?.status_description === "Full";

function programList(pattern, pageInfo) {
  const keyword = (pattern.activity_keyword ?? "").toLowerCase();
  const matches = programs.filter((p) => p.name.toLowerCase().includes(keyword));
  const { page_number = 1, total_records_per_page = 20 } = JSON.parse(pageInfo ?? "{}");
  const start = (page_number - 1) * total_records_per_page;
  return {
    headers: {
      response_code: "0000",
      response_message: "Successful",
      page_info: { total_records: matches.length, page_number, total_records_per_page },
    },
    body: { activity_items: matches.slice(start, start + total_records_per_page) },
  };
}

function programDetail(p) {
  const envelope = fixture("detail.1.json");
  Object.assign(envelope.body.detail, {
    activity_id: p.id,
    activity_name: p.name,
    activity_type: "Activity",
    first_date: today,
    last_date: shiftDay(today, 60),
    space_status: isFull(p) ? "Full" : `${p.total_open} openings remaining`,
  });
  return envelope;
}

function programButtonStatus(p) {
  if (isFull(p)) return fixture("buttonstatus.3.full.json");
  const envelope = fixture("buttonstatus.3.enroll.json");
  const status = envelope.body.button_status;
  status.action_link.href = status.action_link.href.replace(/enroll\/\d+/, `enroll/${p.id}`);
  if (p.activity_online_start_time) {
    // Before registration opens the City sends the time and an empty link.
    status.activity_online_start_time = p.activity_online_start_time;
    status.action_link.href = "";
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
    if (url.pathname.endsWith("/activities/filters")) {
      return send(200, fixture("activities.filters.json"));
    }
    if (url.pathname.endsWith("/activities/list")) {
      const { activity_search_pattern } = JSON.parse(body);
      return send(200, programList(activity_search_pattern, request.headers.page_info));
    }
    const program = programById.get(id);
    if (url.pathname.includes("/estimateprice/") && program) {
      return send(200, fixture("estimateprice.json"));
    }
    if (url.pathname.includes("/meetingandregistrationdates/") && program) {
      return send(200, fixture("meetingdates.json"));
    }
    if (url.pathname.includes("/activity/detail/buttonstatus/") && program)
      return send(200, programButtonStatus(program));
    if (url.pathname.includes("/activity/detail/") && program)
      return send(200, programDetail(program));
    if (url.pathname.includes("/activity/detail/buttonstatus/") && id)
      return send(200, buttonStatus(id));
    if (url.pathname.includes("/activity/detail/") && id) return send(200, detail(id));
    send(404, { headers: { response_code: "9999", response_message: "Not found" }, body: {} });
  });
});

server.listen(PORT, () => console.log(`Mock ActiveNet listening on http://localhost:${PORT}`));
