"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import styles from "./Search.module.css";

/** How long typing must pause before the results update. */
export const SEARCH_DELAY_MS = 300;

/**
 * Search box that updates the results as you type, once you pause for
 * SEARCH_DELAY_MS. Enter searches straight away. It is still a GET form, so
 * without JavaScript Enter submits it normally.
 */
export function SearchBox({
  action,
  defaultValue,
  hiddenFields,
}: {
  action: string;
  defaultValue: string;
  /** The other filters, kept when the form is submitted without JavaScript. */
  hiddenFields: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [waiting, setWaiting] = useState(false);
  const [hasText, setHasText] = useState(defaultValue !== "");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSearched = useRef(defaultValue.trim());
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  // When something else changes the search (e.g. "clear all filters"), show it.
  // Our own searches already match, so typing is never overwritten.
  useEffect(() => {
    if (defaultValue.trim() === lastSearched.current || !input.current) return;
    clearTimeout(timer.current);
    setWaiting(false);
    input.current.value = defaultValue;
    setHasText(defaultValue !== "");
    lastSearched.current = defaultValue.trim();
  }, [defaultValue]);

  function search(value: string) {
    clearTimeout(timer.current);
    setWaiting(false);
    const q = value.replace(/\s+/g, " ").trim();
    if (q === lastSearched.current) return;
    lastSearched.current = q;

    const params = new URLSearchParams(window.location.search);
    if (q) params.set("q", q);
    else params.delete("q");
    params.delete("limit"); // a new search starts from the first page
    const query = params.toString();
    startTransition(() => {
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    });
  }

  return (
    <form
      role="search"
      action={action}
      method="get"
      className={styles.searchForm}
      onSubmit={(event) => {
        event.preventDefault();
        search(input.current?.value ?? "");
      }}
    >
      <label htmlFor="q" className="visually-hidden">
        Search programs, centres or rooms
      </label>
      <input
        ref={input}
        id="q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="e.g. pickleball, swim"
        className={styles.searchInput}
        maxLength={100}
        enterKeyHint="search"
        autoComplete="off"
        aria-describedby="q-status"
        onChange={(event) => {
          const value = event.currentTarget.value;
          setHasText(value !== "");
          clearTimeout(timer.current);
          setWaiting(true);
          timer.current = setTimeout(() => search(value), SEARCH_DELAY_MS);
        }}
      />
      {hiddenFields}
      <span id="q-status" className={styles.searchStatus} role="status" aria-live="polite">
        {pending ? "Searching…" : waiting ? <span aria-hidden="true">…</span> : ""}
      </span>
      {/* Shares the status's spot, so it hides while a search is running. */}
      {hasText && !pending && !waiting && (
        <button
          type="button"
          className={styles.searchClear}
          aria-label="Clear search"
          onClick={() => {
            if (!input.current) return;
            input.current.value = "";
            setHasText(false);
            search("");
            input.current.focus();
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </form>
  );
}
