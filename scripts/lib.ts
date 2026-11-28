import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Writes pretty JSON with a trailing newline, creating the folder if needed. */
export async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/** Runs a script's main function and exits non-zero on failure. */
export function run(main: () => Promise<void>): void {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? `${error.name}: ${error.message}` : error);
    process.exit(1);
  });
}

/**
 * The front-desk number on a mississauga.ca location page, or null if the page
 * has none or it isn't shaped like one (only a number gets written to data/).
 */
export function locationPhone(html: string): string | null {
  const match = /class="location-phone">([^<]+)</.exec(html);
  const phone = match?.[1].replace(/\s+/g, " ").trim() ?? "";
  return /^\d{3}-\d{3}-\d{4}( ext \d{1,5})?$/.test(phone) ? phone : null;
}
