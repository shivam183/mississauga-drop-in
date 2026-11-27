"use client";

import { formatShortDateTime } from "@/lib/format";
import type { EnrollState } from "@/models/availability";
import { telHref } from "@/models/phones";
import styles from "./EnrollPanel.module.css";
import { ExternalLink } from "./ExternalLink";

// An alarm clock, outlined like the other small icons.
const ALARM_ICON =
  "M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0zM12 9v4l2 2M5 3 2 6M22 6l-3-3M6.4 18.7 4 21M17.6 18.7 20 21";

/** The full-width Enroll button, or what to do instead when it isn't available. */
export function EnrollButton({
  state,
  cityUrl,
  reminderHref,
  loading = false,
}: {
  state: EnrollState | null;
  cityUrl: string | null;
  /** The .ics for "Remind me", shown while enrollment is still to open. */
  reminderHref?: string;
  /** The lookup is in flight (not just waiting to scroll into view): animate the placeholder. */
  loading?: boolean;
}) {
  if (!state)
    return (
      <span
        className={`${styles.button} ${styles.placeholder}${loading ? " shimmer" : ""}`}
        aria-hidden="true"
      />
    );

  switch (state.state) {
    case "enroll":
      return (
        <ExternalLink className={`${styles.button} ${styles.primary}`} href={state.url}>
          Enroll now <span aria-hidden="true">↗</span>
        </ExternalLink>
      );
    case "opens":
      return (
        <div className={styles.opens}>
          <span className={`${styles.button} ${styles.disabled}`} aria-disabled="true">
            Opens {formatShortDateTime(state.opensAt)}
          </span>
          {reminderHref && (
            // A plain link to an .ics: an event at the opening time, with an alert before it.
            <a
              href={reminderHref}
              className={`${styles.button} ${styles.secondary} ${styles.remind}`}
              aria-label="Remind me when enrollment opens (adds to your calendar)"
              title="Add a reminder to your calendar"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                <path
                  d={ALARM_ICON}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Remind me
            </a>
          )}
        </div>
      );
    case "full":
      // The card itself already links to the City's page.
      return null;
    case "waitlist":
      return (
        <div className={styles.waitlist}>
          <ExternalLink className={`${styles.button} ${styles.secondary}`} href={state.url}>
            Join waitlist <span aria-hidden="true">↗</span>
          </ExternalLink>
          {state.waiting > 0 && (
            <p className={styles.waiting}>
              {state.waiting} {state.waiting === 1 ? "person" : "people"} on the waitlist
            </p>
          )}
        </div>
      );
    case "closed":
      return (
        <p className={styles.notice}>
          {state.message}
          {cityUrl && (
            <>
              {" "}
              <ExternalLink href={cityUrl}>Details</ExternalLink>
            </>
          )}
        </p>
      );
    case "walk-in":
      // No "Details" link: the card already links to the City's page, and a second
      // link beside the phone number is easy to tap by mistake.
      return (
        <p className={styles.notice}>
          Online enrollment closed when this activity started, but spots were still available. Call
          the centre
          {state.phone && (
            <>
              {" at "}
              <a href={telHref(state.phone)}>{state.phone}</a>
            </>
          )}{" "}
          or ask at the front desk about walking in.
        </p>
      );
    case "unknown":
      return cityUrl ? (
        <ExternalLink className={`${styles.button} ${styles.secondary}`} href={cityUrl}>
          Check on ActiveMississauga
        </ExternalLink>
      ) : null;
  }
}
