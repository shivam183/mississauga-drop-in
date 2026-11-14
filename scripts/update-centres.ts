/**
 * Refreshes data/centres.dropin.json (calendar 1) and data/centres.enrol.json
 * (calendar 3) from the live API. Output is sorted so it only changes when the
 * City's list does. Run weekly by .github/workflows/update-centres.yml.
 *
 *   npm run update-centres
 */
import path from "node:path";
import { activeNetClientFromEnv } from "../src/lib/activenet/client";
import type { CalendarId } from "../src/lib/activenet/types";
import { run, writeJson } from "./lib";

const OUTPUTS: Array<[CalendarId, string]> = [
  [1, "data/centres.dropin.json"],
  [3, "data/centres.enrol.json"],
];

run(async () => {
  const client = activeNetClientFromEnv();
  for (const [calendar, file] of OUTPUTS) {
    const { center } = await client.getFilters(calendar);
    const centres = center
      .map(({ id, name }) => ({ id, name: name.trim() }))
      .sort((a, b) => a.name.localeCompare(b.name, "en") || a.id - b.id);
    await writeJson(path.resolve(file), centres);
    console.log(`calendar ${calendar}: ${centres.length} centres -> ${file}`);
  }
});
