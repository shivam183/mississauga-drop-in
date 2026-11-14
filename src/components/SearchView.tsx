import Link from "next/link";
import { connection } from "next/server";
import { toTorontoLocal } from "@/lib/dates";
import type { Centre } from "@/lib/centres";
import {
  hrefWith,
  PAGE_SIZE,
  parseSearchParams,
  toFilters,
  type RawSearchParams,
} from "@/lib/params";
import { getSchedule } from "@/lib/schedule";
import { filterSessions, groupByDay } from "@/models/filters";
import { AvailabilityProvider } from "./AvailabilityProvider";
import { DayGroup } from "./DayGroup";
import styles from "./Search.module.css";
import { SearchControls } from "./SearchControls";

/**
 * The search page body: controls plus results grouped by day. Reads the URL,
 * so it renders at request time inside a <Suspense> boundary.
 */
export async function SearchView({
  searchParams,
  path,
  centre,
}: {
  searchParams: Promise<RawSearchParams>;
  path: string;
  /** Set on a centre's page. */
  centre?: Centre;
}) {
  const state = parseSearchParams(await searchParams);
  if (centre) state.centreIds = [centre.id];

  const { sessions, failedCentres } = await getSchedule();
  // "Now" (to hide ended sessions) must come from the request, never a prerender.
  await connection();
  const now = toTorontoLocal(new Date());
  const matches = filterSessions(sessions, toFilters(state), now);
  const shown = matches.slice(0, state.limit);
  const relevantFailures = failedCentres.filter(
    (c) => state.centreIds.length === 0 || state.centreIds.includes(c.id),
  );

  return (
    <div className={styles.layout}>
      <SearchControls path={path} state={state} lockedCentre={centre} today={now.slice(0, 10)} />

      <div className={styles.results}>
        <p className={styles.summary} role="status">
          {matches.length === 0
            ? "No upcoming sessions match."
            : `${matches.length.toLocaleString("en-CA")} upcoming ${matches.length === 1 ? "session" : "sessions"}`}
          {matches.length > shown.length && ` · showing the first ${shown.length}`}
        </p>

        {relevantFailures.length > 0 && (
          <p className={styles.warning} role="alert">
            Couldn&rsquo;t load {relevantFailures.map((c) => c.name).join(", ")} right now. Results
            from {relevantFailures.length === 1 ? "that centre" : "those centres"} may be missing.
          </p>
        )}

        {matches.length === 0 && (
          <p className="muted">
            Try fewer words, another type, or{" "}
            <Link href={centre ? path : "/"}>clear all filters</Link>.
          </p>
        )}

        <AvailabilityProvider>
          {groupByDay(shown).map((group) => (
            <DayGroup key={group.date} group={group} today={now.slice(0, 10)} />
          ))}
        </AvailabilityProvider>

        {matches.length > shown.length && (
          <Link
            className={styles.more}
            href={hrefWith(path, state, {
              centreIds: centre ? [] : state.centreIds,
              limit: state.limit + PAGE_SIZE,
            })}
            scroll={false}
          >
            Show more
          </Link>
        )}
      </div>
    </div>
  );
}

/** Placeholder shown while results load (part of the static shell). */
export function SearchSkeleton() {
  return (
    <div className={styles.layout} aria-busy="true">
      <div className={styles.results}>
        <p className={styles.summary}>Loading sessions…</p>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={styles.cardSkeleton} />
        ))}
      </div>
    </div>
  );
}
