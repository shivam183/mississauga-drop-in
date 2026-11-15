import Link from "next/link";
import { ALL_CENTRES, CENTRES_BY_TYPE } from "@/lib/centres";
import { addDays, formatDate, formatDayHeading } from "@/lib/format";
import { activeFilterCount, hrefWith, type SearchState } from "@/lib/params";
import type { TimeOfDay } from "@/models/filters";
import type { SessionType } from "@/models/session";
import { CentrePicker } from "./CentrePicker";
import { FilterForm } from "./FilterForm";
import { FilterSheet } from "./FilterSheet";
import { LinkPending } from "./LinkPending";
import { SearchBox } from "./SearchBox";
import { TYPE_LABEL } from "./TypeBadge";
import styles from "./Search.module.css";

const TYPES: Array<[SessionType | null, string]> = [
  [null, "All"],
  ["dropin", TYPE_LABEL.dropin],
  ["enroll", TYPE_LABEL.enroll],
];

/**
 * One-tap searches for the most common activities: Pickleball first (the most
 * popular), then busiest first. Each `q` matches every variant of the City's
 * titles ("skat": Skate, Figure Skating).
 */
const ACTIVITIES: Array<[q: string, label: string]> = [
  ["pickleball", "Pickleball"],
  ["swim", "Swim"],
  ["yoga", "Yoga"],
  ["skat", "Skate"],
  ["hockey", "Hockey"],
  ["basketball", "Basketball"],
  ["badminton", "Badminton"],
  ["volleyball", "Volleyball"],
  ["table tennis", "Table tennis"],
  ["soccer", "Soccer"],
];

/** Labels and start-time ranges, matching TIME_OF_DAY_HOURS in models/filters. */
const TIMES: Array<[TimeOfDay, string, string]> = [
  ["morning", "Morning", "until 12 PM"],
  ["afternoon", "Afternoon", "12–5 PM"],
  ["evening", "Evening", "from 5 PM"],
];

/** Days offered in the Day picker, starting today. */
const DAYS_AHEAD = 14;

function Hidden({ name, value }: { name: string; value: string | null | undefined }) {
  return value ? <input type="hidden" name={name} value={value} /> : null;
}

export interface SearchControlsProps {
  /** Where the forms and links go, e.g. "/". */
  path: string;
  state: SearchState;
  /** Today in Toronto, "YYYY-MM-DD". */
  today: string;
}

/**
 * Search box, type chips and the filter form. Everything is a plain GET form
 * or link, so filters live in the URL and work without JavaScript.
 */
export function SearchControls({ path, state, today }: SearchControlsProps) {
  const centres = state.type ? CENTRES_BY_TYPE[state.type] : ALL_CENTRES;
  const link = (changes: Partial<SearchState>) => hrefWith(path, state, changes);
  const centreValue = state.centreIds.join(",");

  // Day picker: today plus the next two weeks. A from/to range from a link
  // (or a single day further out) shows as an extra option that keeps it.
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
  const singleDay = state.from && state.from === state.to ? state.from : null;
  const range =
    (state.from || state.to) && !(singleDay && days.includes(singleDay))
      ? [state.from, state.to]
          .map((d) => (d ? formatDate(d) : "…"))
          .filter((d, i, all) => i === 0 || d !== all[0])
          .join(" – ")
      : null;
  const selectedDay = range ? "keep" : (singleDay ?? "any");

  return (
    <>
      <SearchBox
        action={path}
        defaultValue={state.q}
        hiddenFields={
          <>
            <Hidden name="type" value={state.type} />
            <Hidden name="centre" value={centreValue} />
            <Hidden name="from" value={state.from} />
            <Hidden name="to" value={state.to} />
            <Hidden name="time" value={state.times.join(",")} />
          </>
        }
      />

      <nav aria-label="Program type" className={styles.chips}>
        {TYPES.map(([type, label]) => (
          <Link
            key={label}
            href={link({ type })}
            className={styles.chip}
            aria-current={state.type === type ? "page" : undefined}
          >
            {label}
            <LinkPending />
          </Link>
        ))}
      </nav>

      <nav aria-label="Activity" className={`${styles.chips} ${styles.activities}`}>
        {ACTIVITIES.map(([q, label]) => {
          const on = state.q.toLowerCase() === q;
          return (
            <Link
              key={q}
              href={link({ q: on ? "" : q })}
              className={styles.chip}
              aria-current={on ? "page" : undefined}
            >
              {label}
              <LinkPending />
            </Link>
          );
        })}
      </nav>

      <FilterSheet activeCount={activeFilterCount(state)}>
        <FilterForm
          action={path}
          activeCount={activeFilterCount(state)}
          clearHref={link({ centreIds: [], from: null, to: null, times: [] })}
        >
          <Hidden name="q" value={state.q} />
          <Hidden name="type" value={state.type} />

          <div className={styles.field}>
            <label htmlFor="centre">Community centre</label>
            <CentrePicker id="centre" centres={centres} selectedIds={state.centreIds} />
          </div>

          <div className={styles.field}>
            <label htmlFor="day">Day</label>
            {range && (
              <>
                <Hidden name="from" value={state.from} />
                <Hidden name="to" value={state.to} />
              </>
            )}
            <select id="day" name="day" defaultValue={selectedDay}>
              <option value="any">Any day</option>
              {range && <option value="keep">{range}</option>}
              {days.map((day) => (
                <option key={day} value={day}>
                  {formatDayHeading(day, today)}
                </option>
              ))}
            </select>
          </div>

          <fieldset className={styles.field}>
            <legend>Time of day</legend>
            <div className={styles.toggles}>
              {TIMES.map(([value, label, range]) => (
                <label key={value} className={styles.toggle}>
                  <input
                    type="checkbox"
                    name="time"
                    value={value}
                    defaultChecked={state.times.includes(value)}
                  />
                  <span className={styles.toggleLabel}>{label}</span>
                  <span className={styles.toggleRange}>{range}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </FilterForm>
      </FilterSheet>
    </>
  );
}
