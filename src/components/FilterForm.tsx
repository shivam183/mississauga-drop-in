"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  Fragment,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import styles from "./Search.module.css";

const noop = () => () => {};

/** How long a typed filter (the age) waits for the next key, like the search box. */
const TYPING_DELAY_MS = 500;

/** False on the server and during hydration, true once JavaScript runs. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

const ApplyFilters = createContext<() => void>(() => {});

/** Applies the filter form now, for controls that change it without a native event. */
export function useApplyFilters(): () => void {
  return useContext(ApplyFilters);
}

/**
 * The filter form. With JavaScript, every change applies at once, "Clear
 * filters" is a button that clears the URL, and the fields follow the URL.
 * Without JavaScript it's a plain GET form with a submit button and a "Clear
 * filters" link.
 */
export function FilterForm({
  action,
  clearHref,
  activeCount,
  children,
}: {
  action: string;
  /** The current page without filters (the Clear filters target). */
  clearHref: string;
  activeCount: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const form = useRef<HTMLFormElement>(null);
  const typing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [, startTransition] = useTransition();
  const live = useHydrated();

  // The fields are uncontrolled, so when the URL changes from outside the form
  // (Clear filters, a chip, a filter pill, a card's centre link) they're remounted
  // (a new key) to show the new values. The form's own changes are remembered and
  // don't remount it: that would close the centre list mid-pick.
  const [applied, setApplied] = useState<string[]>([]);
  const [seen, setSeen] = useState(search);
  const [generation, setGeneration] = useState(0);
  if (search !== seen) {
    setSeen(search);
    const own = applied.indexOf(search);
    if (own === -1) {
      setGeneration(generation + 1);
      setApplied([]);
    } else {
      // Arrived: forget it and anything older, so a later outside change to the
      // same URL (a pill back to no filters) still resets the fields.
      setApplied(applied.slice(own + 1));
    }
  }

  function apply() {
    if (!form.current) return;
    const params = new URLSearchParams();
    const data = new FormData(form.current);
    for (const [key, value] of data) {
      if (key === "time" || typeof value !== "string" || !value) continue;
      if (key === "day" && value === "any") continue;
      params.append(key, value);
    }
    const times = data.getAll("time");
    if (times.length) params.set("time", times.join(","));
    const query = params.toString();
    setApplied((list) => [...list.slice(-9), query]);
    startTransition(() => {
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    });
  }

  // The same URL as the no-JavaScript link; the fields reset when it arrives (above).
  function clear() {
    startTransition(() => router.replace(clearHref, { scroll: false }));
  }

  return (
    <form
      ref={form}
      action={action}
      method="get"
      className={styles.filterForm}
      // Only named fields are filters (the centre picker's search text isn't). A
      // field marked data-debounce (a typed number) applies once typing pauses.
      onChange={(event) => {
        const field = event.target as unknown as HTMLInputElement;
        if (!field.name) return;
        clearTimeout(typing.current);
        if (field.dataset.debounce === undefined) apply();
        else typing.current = setTimeout(apply, TYPING_DELAY_MS);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      <ApplyFilters.Provider value={apply}>
        <Fragment key={generation}>{children}</Fragment>
      </ApplyFilters.Provider>
      <div className={styles.actions}>
        {live ? (
          <button
            type="button"
            className={styles.clear}
            onClick={clear}
            disabled={activeCount === 0}
          >
            Clear filters
          </button>
        ) : (
          <>
            <button type="submit" className={styles.apply}>
              Show results
            </button>
            <a href={clearHref} className={styles.clearLink}>
              Clear filters
            </a>
          </>
        )}
      </div>
    </form>
  );
}
