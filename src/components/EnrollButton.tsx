"use client";

import { formatDateTime } from "@/lib/format";
import type { EnrollState } from "@/models/availability";
import styles from "./EnrollPanel.module.css";
import { ExternalLink } from "./ExternalLink";

/** The full-width Enroll button, or what to do instead when it isn't available. */
export function EnrollButton({
  state,
  cityUrl,
  loading = false,
}: {
  state: EnrollState | null;
  cityUrl: string | null;
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
        <span className={`${styles.button} ${styles.disabled}`} aria-disabled="true">
          Enrollment opens {formatDateTime(state.opensAt)}
        </span>
      );
    case "full":
      // The card itself already links to the City's page.
      return null;
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
    case "unknown":
      return cityUrl ? (
        <ExternalLink className={`${styles.button} ${styles.secondary}`} href={cityUrl}>
          Check on ActiveMississauga
        </ExternalLink>
      ) : null;
  }
}
