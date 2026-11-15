"use client";

import { formatCheckedAt } from "@/lib/format";
import type { AvailabilityEntry } from "./AvailabilityProvider";
import styles from "./EnrollPanel.module.css";

/** "12 spots left · as of 3:42 pm ↻", coloured by level but always spelled out. */
export function SpotsLeft({
  entry,
  onRefresh,
  refreshState,
}: {
  entry: AvailabilityEntry;
  onRefresh: () => void;
  refreshState: string | undefined;
}) {
  if (entry.phase === "error") {
    return (
      <p className={`${styles.spots} ${styles.error}`} role="status">
        {entry.message}
      </p>
    );
  }
  if (entry.phase !== "ready") {
    return (
      <p className={styles.spots} aria-busy="true">
        <span className={styles.skeleton} />
        <span className="visually-hidden">Checking spots left…</span>
      </p>
    );
  }

  const { spaces, checkedAt } = entry.status;
  const label =
    spaces.level === "full"
      ? "Full"
      : spaces.level === "unknown"
        ? (spaces.text ?? "Spots unknown")
        : `${spaces.count} ${spaces.count === 1 ? "spot" : "spots"} left`;
  const refreshing = refreshState === "";

  return (
    <p className={styles.spots} role="status" aria-live="polite">
      <span className={`${styles.level} ${styles[spaces.level]}`}>{label}</span>
      <span className={styles.asOf}> · as of {formatCheckedAt(checkedAt)}</span>
      <button
        type="button"
        className={styles.refresh}
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Refresh spots left"
        title="Refresh spots left"
      >
        <span aria-hidden="true" className={refreshing ? styles.spinning : undefined}>
          ↻
        </span>
      </button>
      {refreshState && <span className={styles.refreshError}>{refreshState}</span>}
    </p>
  );
}
