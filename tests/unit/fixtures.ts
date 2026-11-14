import { readFileSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve(__dirname, "../fixtures");

/** Reads a recorded ActiveNet response from tests/fixtures/. */
export function fixture<T = { headers: Record<string, unknown>; body: Record<string, unknown> }>(
  name: string,
): T {
  return JSON.parse(readFileSync(path.join(DIR, name), "utf8")) as T;
}
