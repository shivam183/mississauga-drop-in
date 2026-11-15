/**
 * Nightly health check of the unofficial ActiveNet API (8 requests). Fails if
 * a response no longer has the shape we rely on, or if spot counts use
 * wording we don't understand. Run by .github/workflows/api-health.yml.
 *
 *   npm run check-api
 */
import { activeNetClientFromEnv } from "../src/lib/activenet/client";
import { toTorontoLocal } from "../src/lib/dates";
import { run } from "./lib";

const SPACE_STATUS = /^(Full|\d+ openings? remaining)$/;

run(async () => {
  const client = activeNetClientFromEnv();
  const problems: string[] = [];
  const now = toTorontoLocal(new Date());

  const dropInCentres = (await client.getFilters(1)).center;
  const enrollCentres = (await client.getFilters(3)).center;
  console.log(
    `ok filters: ${dropInCentres.length} drop-in centres, ${enrollCentres.length} enroll centres`,
  );
  if (dropInCentres.length === 0) problems.push("calendar 1 lists no centres");
  if (enrollCentres.length === 0) problems.push("calendar 3 lists no centres");

  const dropIn = (await client.getEvents(1, [dropInCentres[0].id])).center_events;
  const dropInCount = dropIn.reduce((n, c) => n + c.events.length, 0);
  console.log(`ok events (calendar 1, ${dropInCentres[0].name}): ${dropInCount} sessions`);
  if (dropInCount === 0) problems.push(`calendar 1 has no sessions at ${dropInCentres[0].name}`);

  const enroll = (await client.getEvents(3, [enrollCentres[0].id])).center_events;
  const upcoming = enroll
    .flatMap((c) => c.events)
    .filter((e) => e.start_time > now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  console.log(
    `ok events (calendar 3, ${enrollCentres[0].name}): ${upcoming.length} upcoming sessions`,
  );

  // The soonest and the furthest session cover "enroll now / full" and "opens later".
  for (const session of [upcoming[0], upcoming.at(-1)].filter((s) => s !== undefined)) {
    const label = `${session.event_item_id} (${session.start_time})`;
    const { detail } = await client.getActivityDetail(session.event_item_id);
    if (detail.activity_id !== session.event_item_id) {
      problems.push(`detail ${label} returned activity ${detail.activity_id}`);
    }
    if (!SPACE_STATUS.test(detail.space_status ?? "")) {
      problems.push(
        `detail ${label} has unknown space_status ${JSON.stringify(detail.space_status)}`,
      );
    }
    const { button_status: status } = await client.getButtonStatus(
      session.event_item_id,
      session.start_time,
    );
    console.log(
      `ok session ${label}: "${detail.space_status}", opens "${status.activity_online_start_time}", ` +
        `link ${status.action_link ? "yes" : "no"}`,
    );
    if (
      status.action_link &&
      !/^https:\/\/[^/]*\.activecommunities\.com\//.test(status.action_link.href)
    ) {
      problems.push(`buttonstatus ${label} links off-site: ${status.action_link.href}`);
    }
  }
  if (upcoming.length === 0)
    problems.push(`calendar 3 has no upcoming sessions at ${enrollCentres[0].name}`);

  if (problems.length > 0) {
    throw new Error(
      `API health check found ${problems.length} problem(s):\n- ${problems.join("\n- ")}`,
    );
  }
  console.log("ActiveNet API looks healthy.");
});
