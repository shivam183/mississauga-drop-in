"use client";

import { formatShortDateTime } from "@/lib/format";
import type { EnrollState } from "@/models/availability";
import { telHref } from "@/models/phones";
import styles from "./EnrollPanel.module.css";
import { ALARM_ICON, ButtonIcon as Icon, ENROLL_ICON, JOIN_ICON, WEB_ICON } from "./ButtonIcon";
import { ExternalLink } from "./ExternalLink";

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
          <Icon d={ENROLL_ICON} />
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
              <Icon d={ALARM_ICON} />
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
        <ExternalLink className={`${styles.button} ${styles.secondary}`} href={state.url}>
          <Icon d={JOIN_ICON} />
          Join waitlist{state.waiting > 0 && ` · ${state.waiting} waiting`}{" "}
          <span aria-hidden="true">↗</span>
        </ExternalLink>
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
          <Icon d={WEB_ICON} />
          Check on ActiveMississauga
        </ExternalLink>
      ) : null;
  }
}
