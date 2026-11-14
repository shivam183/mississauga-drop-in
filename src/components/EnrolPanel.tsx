"use client";

import { useRef } from "react";
import { toTorontoLocal } from "@/lib/dates";
import { toEnrolState } from "@/models/availability";
import { useAvailability } from "./AvailabilityProvider";
import { EnrolButton } from "./EnrolButton";
import { ExternalLink } from "./ExternalLink";
import styles from "./EnrolPanel.module.css";
import { SpotsLeft } from "./SpotsLeft";

/** Spots left and the Enrol button for one "enrol online" session. */
export function EnrolPanel({
  activityId,
  cityUrl,
}: {
  activityId: number;
  cityUrl: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { entry, refresh, refreshState } = useAvailability(activityId, ref);
  const status = entry.phase === "ready" ? entry.status : null;
  const state = entry.phase === "ready" ? toEnrolState(status, toTorontoLocal(new Date())) : null;
  // For the card's visual cue (see SessionCard.module.css). A stripe only when
  // you can enrol (now or later); faded when full.
  const level =
    state?.state === "full"
      ? "full"
      : (state?.state === "enrol" || state?.state === "opens") && status?.spaces.level !== "unknown"
        ? status?.spaces.level
        : undefined;

  return (
    <div ref={ref} className={styles.panel} data-level={level}>
      <SpotsLeft entry={entry} onRefresh={refresh} refreshState={refreshState} />
      <EnrolButton
        state={entry.phase === "error" ? { state: "unknown" } : state}
        cityUrl={cityUrl}
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
