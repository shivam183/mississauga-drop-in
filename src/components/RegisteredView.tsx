import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  getProgramOptions,
  getSeasonInfo,
  hasMorePages,
  searchPrograms,
  type ProgramOptions,
} from "@/lib/registered";
import {
  activeProgramFilterCount,
  MAX_PAGES,
  parseProgramParams,
  programHref,
  seasonStatus,
  WEEKDAY_KEYS,
  type ProgramSearch,
} from "@/models/registered";
import { toTorontoLocal } from "@/lib/dates";
import type { RawSearchParams } from "@/lib/params";
import { AgeStepper } from "./AgeStepper";
import { CentrePicker } from "./CentrePicker";
import { ReopenDetails } from "./DetailsPreview";
import { FilterForm } from "./FilterForm";
import { FilterPills, type FilterPill } from "./FilterPills";
import { FilterSheet } from "./FilterSheet";
import { LinkPending } from "./LinkPending";
import { RegisteredCard } from "./RegisteredCard";
import { ScrollTopButton } from "./ScrollTopButton";
import { SearchBox } from "./SearchBox";
import { Hidden } from "./SearchControls";
import styles from "./Search.module.css";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Quick picks under the search box. Most are a City category, found by its
 * name so a renumbered id still works (a missing one is left out); camps span
 * three categories, so that one searches "camp".
 */
const CHIPS: Array<{ label: string; icon: string; category?: string; q?: string }> = [
  { label: "Swim lessons", icon: "🏊", category: "Swimming Lessons" },
  { label: "Camps", icon: "🏕️", q: "camp" },
  { label: "Sports", icon: "🏀", category: "Sports" },
  { label: "Fitness", icon: "💪", category: "Fitness" },
  { label: "Skating", icon: "⛸️", category: "Skating & Hockey" },
  { label: "Dance & music", icon: "💃", category: "Dance, Drama, Music" },
  { label: "Arts", icon: "🎨", category: "Arts" },
  { label: "Leagues", icon: "🏆", category: "Sport Leagues" },
  { label: "Learning", icon: "📚", category: "Learning" },
];

function RegisteredChips({
  state,
  options,
}: {
  state: ProgramSearch;
  options: ProgramOptions | null;
}) {
  // One chip at a time: picking one drops another chip's keyword or category.
  const chipQ = CHIPS.some((c) => c.q === state.q.toLowerCase());
  const chips = CHIPS.flatMap(({ label, icon, category, q }) => {
    if (q) {
      const on = state.q.toLowerCase() === q;
      return [
        { label, icon, on, href: programHref(state, on ? { q: "" } : { q, category: null }) },
      ];
    }
    const id = options?.categories.find((c) => c.label === category)?.id;
    if (!id) return [];
    const on = state.category === id;
    const href = on
      ? programHref(state, { category: null })
      : programHref(state, { category: id, ...(chipQ ? { q: "" } : {}) });
    return [{ label, icon, on, href }];
  });
  return (
    <nav aria-label="Program type" className={styles.chips}>
      {chips.map(({ label, icon, on, href }) => (
        <Link
          key={label}
          href={href}
          className={styles.chip}
          aria-current={on ? "page" : undefined}
        >
          <span aria-hidden="true">{icon}&nbsp;</span>
          {label}
          <LinkPending />
        </Link>
      ))}
    </nav>
  );
}

/**
 * The /registered body: search, filters and results from the City's activity
 * search. Reads the URL, so it renders at request time inside <Suspense>.
 */
export async function RegisteredView({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const state = parseProgramParams(await searchParams);
  // Results and "now" come from the request, never a prerender. Outside the catch
  // below: during prerendering this rejects on purpose, and must not read as a failed search.
  await connection();
  const now = toTorontoLocal(new Date());
  const [options, results] = await Promise.all([
    getProgramOptions().catch(() => null),
    searchPrograms(state).catch((error: unknown) => {
      console.error("[programs] search failed:", error instanceof Error ? error.message : error);
      return null;
    }),
  ]);
  const more = results !== null && hasMorePages(results, state.pages);

  return (
    <div className={styles.layout}>
      <RegisteredControls state={state} options={options} now={now} />

      <div className={styles.results}>
        {/* After a refresh of an open popup: reopens it over this list. */}
        <ReopenDetails />
        <ActiveFilters state={state} options={options} />
        {results === null ? (
          <p className={styles.warning} role="alert">
            Couldn&rsquo;t reach ActiveMississauga just now. Try again in a moment.
          </p>
        ) : (
          <>
            <p className={styles.summary} role="status">
              {results.total === 0
                ? "No programs match"
                : `${results.total.toLocaleString("en-CA")} ${results.total === 1 ? "program" : "programs"}`}
              {results.upcomingIds.length > 0 && " in upcoming seasons"}
              {more && ` · showing the first ${results.programs.length}`}
            </p>
            {/* The default leaves out seasons that are well under way; say so, with the way back. */}
            {results.upcomingIds.length > 0 && (
              <p className={styles.seasonNote}>
                Programs already under way are hidden.{" "}
                <Link href={programHref(state, { season: "all" })}>Show all seasons</Link>
              </p>
            )}
          </>
        )}

        {results?.total === 0 && (
          <p className="muted">
            Try fewer words, another age or day, or{" "}
            <Link href="/registered">clear all filters</Link>.
          </p>
        )}

        {results && results.programs.length > 0 && (
          <div className={styles.programList}>
            {results.programs.map((program) => (
              <RegisteredCard key={program.id} program={program} />
            ))}
          </div>
        )}

        {more &&
          (state.pages < MAX_PAGES ? (
            <Link
              className={styles.more}
              href={programHref(state, { pages: state.pages + 1 })}
              scroll={false}
            >
              Show more
              <LinkPending />
            </Link>
          ) : (
            <p className="muted">Narrow the search (age, day or centre) to see more.</p>
          ))}
      </div>
      <ScrollTopButton />
    </div>
  );
}

/** The filters in use as pills. The chip's category and the default upcoming seasons aren't pills. */
function ActiveFilters({
  state,
  options,
}: {
  state: ProgramSearch;
  options: ProgramOptions | null;
}) {
  const season =
    state.season === "all"
      ? "All seasons"
      : (options?.seasons.find((s) => s.id === state.season)?.label ?? (state.season && "Season"));
  // "Age 6", "Age under 1"; adults by their menu name ("Adult", "Older adult (55+)").
  const age = state.age === null ? "" : `Age ${state.age}`;
  const pills = [
    season && { label: season, href: programHref(state, { season: null }) },
    age && { label: age, href: programHref(state, { age: null }) },
    ...state.days.map((day) => ({
      label: DAY_NAMES[WEEKDAY_KEYS.indexOf(day)],
      href: programHref(state, { days: state.days.filter((d) => d !== day) }),
    })),
    ...state.centreIds.map((id) => ({
      label: options?.centres.find((c) => c.id === id)?.name ?? "A centre",
      href: programHref(state, { centreIds: state.centreIds.filter((c) => c !== id) }),
    })),
    state.open && { label: "Has open spots", href: programHref(state, { open: false }) },
  ].filter((p): p is FilterPill => Boolean(p));
  return <FilterPills pills={pills} />;
}

function RegisteredControls({
  state,
  options,
  now,
}: {
  state: ProgramSearch;
  options: ProgramOptions | null;
  now: string;
}) {
  const count = activeProgramFilterCount(state);
  return (
    <>
      <SearchBox
        action="/registered"
        defaultValue={state.q}
        hiddenFields={
          <>
            <Hidden name="cat" value={state.category} />
            <Hidden name="season" value={state.season} />
            <Hidden name="age" value={state.age === null ? null : String(state.age)} />
            <Hidden name="day" value={state.days.join(",")} />
            <Hidden name="centre" value={state.centreIds.join(",")} />
            <Hidden name="open" value={state.open ? "1" : null} />
          </>
        }
      />

      <RegisteredChips state={state} options={options} />

      <FilterSheet activeCount={count}>
        <FilterForm
          action="/registered"
          activeCount={count}
          // Keeps the category, like drop-in's Clear keeps the activity chip.
          clearHref={programHref(state, {
            season: null,
            age: null,
            days: [],
            centreIds: [],
            open: false,
          })}
        >
          <Hidden name="q" value={state.q} />
          {/* The category comes from the chips; there's no menu for it. */}
          <Hidden name="cat" value={state.category} />

          {options && options.seasons.length > 0 && (
            <Suspense fallback={<SeasonField state={state} seasons={options.seasons} />}>
              <CountedSeasonField state={state} options={options} now={now} />
            </Suspense>
          )}

          {/* An exact age: the City matches programs that age can join. Adults type theirs too. */}
          <div className={styles.field}>
            <label htmlFor="age">Age</label>
            <AgeStepper id="age" defaultValue={state.age} />
          </div>

          {/* Any of the days ticked; none means any day. */}
          <fieldset className={styles.field}>
            <legend>Days</legend>
            <div className={styles.days}>
              {WEEKDAY_KEYS.map((key, i) => (
                <label key={key} className={styles.toggle}>
                  <input
                    type="checkbox"
                    name="day"
                    value={key}
                    defaultChecked={state.days.includes(key)}
                    aria-label={DAY_NAMES[i]}
                  />
                  <span className={styles.toggleLabel} aria-hidden="true">
                    {DAY_NAMES[i].slice(0, 3)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {options && (
            <div className={styles.field}>
              <label htmlFor="centre">Location</label>
              <CentrePicker id="centre" centres={options.centres} selectedIds={state.centreIds} />
            </div>
          )}

          <div className={`${styles.toggles} ${styles.toggleWide}`}>
            <label className={styles.toggle}>
              <input type="checkbox" name="open" value="1" defaultChecked={state.open} />
              <span className={styles.toggleLabel}>Has open spots</span>
            </label>
          </div>
        </FilterForm>
      </FilterSheet>
    </>
  );
}

/**
 * The Season filter with each season's status and program count ("2027 Winter
 * · registration opens Nov 24 (4,704)"), leaving out empty seasons.
 */
async function CountedSeasonField({
  state,
  options,
  now,
}: {
  state: ProgramSearch;
  options: ProgramOptions;
  now: string;
}) {
  const info = await getSeasonInfo(
    options.seasons.map((s) => s.id),
    options.typeIds,
  ).catch(() => null);
  if (!info) return <SeasonField state={state} seasons={options.seasons} />;
  const seasons = options.seasons
    .filter((s) => info[s.id]?.count > 0 || s.id === state.season)
    .map((s) => {
      const season = info[s.id];
      if (!season) return s;
      const status = seasonStatus(season, now);
      const count = season.count.toLocaleString("en-CA");
      return { ...s, label: `${s.label}${status ? ` · ${status}` : ""} (${count})` };
    });
  return <SeasonField state={state} seasons={seasons} />;
}

function SeasonField({
  state,
  seasons,
}: {
  state: ProgramSearch;
  seasons: ProgramOptions["seasons"];
}) {
  return (
    <div className={styles.field}>
      <label htmlFor="season">Season</label>
      <select id="season" name="season" defaultValue={state.season ?? ""}>
        <option value="">Upcoming seasons</option>
        <option value="all">All seasons</option>
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
