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
