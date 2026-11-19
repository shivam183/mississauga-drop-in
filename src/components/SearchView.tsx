import Link from "next/link";
import { connection } from "next/server";
import { ALL_CENTRES } from "@/lib/centres";
import { toTorontoLocal } from "@/lib/dates";
import { formatDate, formatDayHeading } from "@/lib/format";
import {
  hrefWith,
  PAGE_SIZE,
  parseSearchParams,
  toFilters,
  withDefaults,
  type RawSearchParams,
  type SearchState,
} from "@/lib/params";
import { getSchedule } from "@/lib/schedule";
import { filterSessions, pageDays } from "@/models/filters";
import { DayGroup } from "./DayGroup";
import { ReopenDetails } from "./DetailsPreview";
import { FilterPills, type FilterPill } from "./FilterPills";
import { LinkPending } from "./LinkPending";
import { ScrollTopButton } from "./ScrollTopButton";
import styles from "./Search.module.css";
import { SearchControls, TIMES } from "./SearchControls";
import { TYPE_LABEL } from "./TypeBadge";

/**
 * The search page body: controls plus results grouped by day. Reads the URL,
 * so it renders at request time inside a <Suspense> boundary.
 */
export async function SearchView({
  searchParams,
  path,
  defaults = {},
}: {
  searchParams: Promise<RawSearchParams>;
  path: string;
  /** Fill fields the URL leaves empty; every control still links to `path`. */
  defaults?: Partial<SearchState>;
}) {
  const state = withDefaults(parseSearchParams(await searchParams), defaults);

  const { sessions, failedCentres } = await getSchedule();
  // "Now" (to hide ended sessions) must come from the request, never a prerender.
  await connection();
  const now = toTorontoLocal(new Date());
  const matches = filterSessions(sessions, toFilters(state), now);
  const page = pageDays(matches, state.limit, state.collapsed);
  const relevantFailures = failedCentres.filter(
    (c) => state.centreIds.length === 0 || state.centreIds.includes(c.id),
  );

  return (
    <div className={styles.layout}>
      <SearchControls path={path} state={state} today={now.slice(0, 10)} />

      <div className={styles.results}>
        {/* After a refresh of an open popup: reopens it over this list. */}
        <ReopenDetails />
        {!state.session && (
          <FilterPills pills={dropInPills(path, state, defaults, now.slice(0, 10))} />
        )}
        {state.session ? (
          // A shared link shows just that session (see ShareButton).
          <p className={styles.summary} role="status">
            {matches.length === 0
              ? "This shared session has ended or is no longer listed."
              : "Shared session"}{" "}
            · <Link href={hrefWith(path, state, {})}>Show all sessions</Link>
          </p>
        ) : (
          <p className={styles.summary} role="status">
            {matches.length === 0
              ? "No upcoming sessions match."
              : `${matches.length.toLocaleString("en-CA")} upcoming ${matches.length === 1 ? "session" : "sessions"}`}
            {page.more && ` · showing the first ${page.shown}`}
          </p>
        )}

        {relevantFailures.length > 0 && (
          <p className={styles.warning} role="alert">
            Couldn&rsquo;t load {relevantFailures.map((c) => c.name).join(", ")} right now. Results
            from {relevantFailures.length === 1 ? "that centre" : "those centres"} may be missing.
          </p>
        )}

        {matches.length === 0 && !state.session && (
          <p className="muted">
            Try fewer words, another type, or <Link href={path}>clear all filters</Link>.
          </p>
        )}

        {page.days.map((group) => (
          <DayGroup
            key={group.date}
            group={group}
            now={now}
            // A card's centre name adds that centre to the filter.
            centreHref={(id) =>
              hrefWith(path, state, { centreIds: [...new Set([...state.centreIds, id])] })
            }
          />
        ))}

        {page.more && (
          <Link
            className={styles.more}
            // Collapsed days stay collapsed.
            href={hrefWith(path, state, {
              limit: state.limit + PAGE_SIZE,
              collapsed: state.collapsed,
            })}
            scroll={false}
          >
            Show more
            <LinkPending />
          </Link>
        )}
      </div>
      <ScrollTopButton />
    </div>
  );
}

/**
 * The filters in use as pills: type, date, times and centres. The search text
 * and chips aren't (the chip row shows them), nor what the page itself sets
 * (a centre page's centre), which can't be removed there.
 */
function dropInPills(
  path: string,
  state: SearchState,
  defaults: Partial<SearchState>,
  today: string,
): FilterPill[] {
  const link = (changes: Partial<SearchState>) => hrefWith(path, state, changes);
  const date =
    state.from && state.from === state.to
      ? formatDayHeading(state.from, today)
      : [state.from, state.to]
          .map((d) => (d ? formatDate(d) : "…"))
          .filter((d, i, all) => i === 0 || d !== all[0])
          .join(" – ");
  return [
    ...(state.type && state.type !== defaults.type
      ? [{ label: TYPE_LABEL[state.type], href: link({ type: null }) }]
      : []),
    ...(state.from || state.to ? [{ label: date, href: link({ from: null, to: null }) }] : []),
    ...state.times.map((time) => ({
      label: TIMES.find(([t]) => t === time)?.[1] ?? time,
      href: link({ times: state.times.filter((t) => t !== time) }),
    })),
    ...state.centreIds
      .filter((id) => !defaults.centreIds?.includes(id))
      .map((id) => ({
        label: ALL_CENTRES.find((c) => c.id === id)?.name ?? "A centre",
        href: link({ centreIds: state.centreIds.filter((c) => c !== id) }),
      })),
  ];
}

/** Placeholder shown while results load (part of the static shell). */
export function SearchSkeleton() {
  return (
    <div className={styles.layout} aria-busy="true">
      <div className={styles.results}>
        <p className={styles.summary}>Loading sessions…</p>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${styles.cardSkeleton} shimmer`} />
        ))}
      </div>
    </div>
  );
}
