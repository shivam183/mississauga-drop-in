"use client";

import { usePathname, useRouter } from "next/navigation";
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
 * The filter form. With JavaScript, every change applies at once and "Clear
 * filters" is a button that clears the URL and then resets the fields.
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
  const form = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();
  const live = useHydrated();

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
    startTransition(() => {
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    });
  }

  // "Clear filters" goes to clearHref, the same URL as the no-JavaScript link.
  // The fields are uncontrolled, so once the cleared page arrives they're
  // remounted (a new key) to pick up its empty defaults. Remounting earlier
  // would show the old defaults; remounting on every change would close the
  // centre list mid-pick.
  const [clearing, setClearing] = useState(false);
  const [generation, setGeneration] = useState(0);
  if (clearing && activeCount === 0) {
    setClearing(false);
    setGeneration(generation + 1);
  }

  function clear() {
    setClearing(true);
    startTransition(() => router.replace(clearHref, { scroll: false }));
  }

  return (
    <form
      ref={form}
      action={action}
      method="get"
      className={styles.filterForm}
      // Only named fields are filters (the centre picker's search text isn't).
      onChange={(event) => {
        if ((event.target as unknown as HTMLInputElement).name) apply();
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
