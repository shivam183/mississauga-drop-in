"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { ALL_CENTRES } from "@/lib/centres";
import { hrefWith, parseSearchParams, type SearchState } from "@/lib/params";
import { LinkPending } from "./LinkPending";
import styles from "./Search.module.css";

const KEY = "centres";
const noop = () => () => {};

/** The saved centre ids ("290,119"), or null when there are none or storage is blocked. */
function readSaved(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * Remembers the last centres someone filtered by (in this browser only), and
 * when the list isn't filtered by centre, offers them back as a one-tap
 * "My centres" chip. Nothing is applied until it's tapped.
 */
export function SavedCentres({ path, state }: { path: string; state: SearchState }) {
  const chosen = state.centreIds.join(",");
  useEffect(() => {
    if (!chosen) return;
    try {
      localStorage.setItem(KEY, chosen);
    } catch {
      // Storage blocked (e.g. private mode): there's just no chip next time.
    }
  }, [chosen]);

  // null on the server and during hydration, so the chip appears only after.
  const saved = useSyncExternalStore(noop, readSaved, () => null);
  if (chosen || !saved) return null;

  // Parsing drops ids that aren't centres any more.
  const ids = parseSearchParams({ centre: saved }).centreIds;
  if (ids.length === 0) return null;
  // ALL_CENTRES is sorted by name, so this names the first alphabetically.
  const first = ALL_CENTRES.find((c) => ids.includes(c.id))!.name.replace(/ Community Centre$/, "");
  const label = ids.length > 1 ? `${first} +${ids.length - 1}` : first;

  return (
    <Link href={hrefWith(path, state, { centreIds: ids })} className={styles.chip}>
      <span aria-hidden="true">📍&nbsp;</span>My centres: {label}
      <LinkPending />
    </Link>
  );
}
