"use client";

import { formatDateTime } from "@/lib/format";
import type { EnrolState } from "@/models/availability";
import styles from "./EnrolPanel.module.css";
import { ExternalLink } from "./ExternalLink";

/** The full-width Enrol button, or what to do instead when it isn't available. */
export function EnrolButton({
  state,
  cityUrl,
}: {
  state: EnrolState | null;
  cityUrl: string | null;
}) {
  if (!state)
    return <span className={`${styles.button} ${styles.placeholder}`} aria-hidden="true" />;

  switch (state.state) {
    case "enrol":
      return (
        <ExternalLink className={`${styles.button} ${styles.primary}`} href={state.url}>
          Enrol now <span aria-hidden="true">↗</span>
        </ExternalLink>
      );
    case "opens":
      return (
        <span className={`${styles.button} ${styles.disabled}`} aria-disabled="true">
          Enrolment opens {formatDateTime(state.opensAt)}
        </span>
      );
    case "full":
      return cityUrl ? (
        <ExternalLink className={styles.link} href={cityUrl}>
          See it on ActiveMississauga
        </ExternalLink>
      ) : null;
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
