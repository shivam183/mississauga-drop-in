"use client";

import { useRef } from "react";
import { toTorontoLocal } from "@/lib/dates";
import { toEnrollState, type EnrollState } from "@/models/availability";
import { useAvailability, type AvailabilityEntry } from "./AvailabilityProvider";
import { EnrollButton } from "./EnrollButton";
import { ExternalLink } from "./ExternalLink";
import styles from "./EnrollPanel.module.css";
import { SpotsLeft } from "./SpotsLeft";

/** EnrollButton's state and loading for an entry (shared with the details popup). */
export function enrollButtonProps(entry: AvailabilityEntry): {
  state: EnrollState | null;
  loading: boolean;
} {
  if (entry.phase === "error") return { state: { state: "unknown" }, loading: false };
  return {
    state: entry.phase === "ready" ? toEnrollState(entry.status, toTorontoLocal(new Date())) : null,
    loading: entry.phase === "loading",
  };
}

/** Spots left and the Enroll button for one "enroll online" session. */
export function EnrollPanel({
  activityId,
  cityUrl,
}: {
  activityId: number;
  cityUrl: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { entry, refresh, refreshState } = useAvailability(activityId, ref);
  const status = entry.phase === "ready" ? entry.status : null;
  const { state, loading } = enrollButtonProps(entry);
  // For the card's visual cue (see SessionCard.module.css). A stripe only when
  // you can enroll (now or later); faded when full.
  const level =
    state?.state === "full" || state?.state === "waitlist"
      ? "full"
      : (state?.state === "enroll" || state?.state === "opens") &&
          status?.spaces.level !== "unknown"
        ? status?.spaces.level
        : undefined;

  return (
    <div ref={ref} className={styles.panel} data-level={level}>
      <SpotsLeft entry={entry} onRefresh={refresh} refreshState={refreshState} />
      <EnrollButton
        state={state}
        cityUrl={cityUrl}
        reminderHref={`/activity/${activityId}/reminder`}
        loading={loading}
      />
      <noscript>
        {cityUrl && (
          <ExternalLink className={styles.fallback} href={cityUrl}>
            Check spots on ActiveMississauga
          </ExternalLink>
        )}
      </noscript>
    </div>
  );
}
