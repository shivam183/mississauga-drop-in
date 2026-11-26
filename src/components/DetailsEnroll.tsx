"use client";

import { useRef } from "react";
import { useAvailability } from "./AvailabilityProvider";
import { EnrollButton } from "./EnrollButton";
import { enrollButtonProps } from "./EnrollPanel";
import { SpotsLeft } from "./SpotsLeft";

// The details popup splits EnrollPanel in two: spots in the session box, the
// button in the pinned bar. Both read the same store entry, which the
// provider requests once per session (and the card behind may already have).

export function DetailsSpots({
  activityId,
  className,
}: {
  activityId: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { entry, refresh, refreshState } = useAvailability(activityId, ref);
  return (
    <div ref={ref} className={className}>
      <SpotsLeft entry={entry} onRefresh={refresh} refreshState={refreshState} />
    </div>
  );
}

export function DetailsEnrollButton({
  activityId,
  cityUrl,
}: {
  activityId: number;
  cityUrl: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { entry } = useAvailability(activityId, ref);
  return (
    <div ref={ref}>
      <EnrollButton
        {...enrollButtonProps(entry)}
        cityUrl={cityUrl}
        reminderHref={`/activity/${activityId}/reminder`}
      />
    </div>
  );
}
