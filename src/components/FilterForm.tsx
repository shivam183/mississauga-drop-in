"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useRef,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import styles from "./Search.module.css";

const noop = () => () => {};

const ApplyFilters = createContext<() => void>(() => {});

/** Applies the filter form now, for controls that change it without a native event. */
export function useApplyFilters(): () => void {
  return useContext(ApplyFilters);
}

/**
 * The filter form. With JavaScript, every change applies at once and "Clear
 * filters" is a button that resets the fields too. Without JavaScript it's a
 * plain GET form with a submit button and a "Clear filters" link.
 */
export function FilterForm({
  action,
  clearHref,
  activeCount,
  children,
}: {
  action: string;
  /** The current page without filters, for the no-JavaScript link. */
  clearHref: string;
  activeCount: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const form = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();
  // False on the server and during hydration, true once JavaScript runs.
  const live = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

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

  function clear() {
    const el = form.current;
    if (!el) return;
    for (const select of el.querySelectorAll("select")) {
      select.value = select.name === "day" ? "any" : "";
    }
    for (const box of el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
      box.checked = false;
    }
    for (const centre of el.querySelectorAll<HTMLInputElement>(
      'input[type="hidden"][name="centre"]',
    )) {
      centre.value = "";
    }
    el.dispatchEvent(new Event("filters:clear")); // lets the centre picker reset its text
    // A from/to range carried over from a link.
    for (const hidden of el.querySelectorAll<HTMLInputElement>(
      'input[type="hidden"][name="from"], input[type="hidden"][name="to"]',
    )) {
      hidden.remove();
    }
    el.querySelector('select[name="day"] option[value="keep"]')?.remove();
    apply();
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
      <ApplyFilters.Provider value={apply}>{children}</ApplyFilters.Provider>
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
