"use client";

import { useRef } from "react";
import { useAvailability } from "./AvailabilityProvider";
import { EnrollButton } from "./EnrollButton";
import { enrollButtonProps } from "./EnrollPanel";

/**
 * A full program card's "Join waitlist", looked up as it nears the screen (the
 * search list only says "Full"). Nothing when there's no waitlist or the
 * lookup fails: the card already says Full and links to the City.
 */
export function ProgramWaitlist({ id, className }: { id: number; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { entry } = useAvailability(id, ref, "program");
  const { state, loading } = enrollButtonProps(entry);
  const shown = !state || state.state === "waitlist";
  return (
    <div ref={ref} className={shown ? className : undefined}>
      {shown && <EnrollButton state={state} cityUrl={null} loading={loading} />}
    </div>
  );
}
