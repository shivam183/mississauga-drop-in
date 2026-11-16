"use client";

import { useRef } from "react";
import { toTorontoLocal } from "@/lib/dates";
import { toEnrollState } from "@/models/availability";
import { useAvailability } from "./AvailabilityProvider";
import { EnrollButton } from "./EnrollButton";
import { ExternalLink } from "./ExternalLink";
import styles from "./EnrollPanel.module.css";
import { SpotsLeft } from "./SpotsLeft";

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
  const state = status && toEnrollState(status, toTorontoLocal(new Date()));
  // For the card's visual cue (see SessionCard.module.css). A stripe only when
  // you can enroll (now or later); faded when full.
  const level =
    state?.state === "full"
      ? "full"
      : (state?.state === "enroll" || state?.state === "opens") &&
          status?.spaces.level !== "unknown"
        ? status?.spaces.level
        : undefined;

  return (
    <div ref={ref} className={styles.panel} data-level={level}>
      <SpotsLeft entry={entry} onRefresh={refresh} refreshState={refreshState} />
      <EnrollButton
        state={entry.phase === "error" ? { state: "unknown" } : state}
        cityUrl={cityUrl}
        loading={entry.phase === "loading"}
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
