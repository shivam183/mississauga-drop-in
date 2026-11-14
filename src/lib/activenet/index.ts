import { activeNetClientFromEnv, type ActiveNetClient } from "./client";

let client: ActiveNetClient | undefined;

/** The app's shared ActiveNet client, configured from the environment. Server-side only. */
export function getActiveNetClient(): ActiveNetClient {
  client ??= activeNetClientFromEnv();
  return client;
}

/** For tests: use this client instead (or pass nothing to go back to the default). */
export function setActiveNetClient(replacement?: ActiveNetClient): void {
  client = replacement;
}
