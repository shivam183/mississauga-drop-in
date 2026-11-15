import Link from "next/link";
import { displayTitle, formatTimeRange } from "@/lib/format";
import { EMPTY_SEARCH, hrefWith } from "@/lib/params";
import type { Session } from "@/models/session";
import { EnrollPanel } from "./EnrollPanel";
import { ExternalLink } from "./ExternalLink";
import { LinkPending } from "./LinkPending";
import styles from "./SessionCard.module.css";
import { ShareButton } from "./ShareButton";
import { TypeBadge } from "./TypeBadge";

/** One result. Time first and largest, centre second, then spots and Enroll for "enroll" sessions. */
export function SessionCard({
  session,
  centreHref,
}: {
  session: Session;
  /** Where the centre name goes: the list filtered to that centre. */
  centreHref: string;
}) {
  const title = displayTitle(session.title);
  const time = formatTimeRange(session.start, session.end);
  const day = session.start.slice(0, 10);
  return (
    <article className={styles.card} aria-label={`${title}, ${time}`}>
      <div className={styles.top}>
        <p className={styles.time}>
          <time dateTime={session.start.replace(" ", "T")}>{time}</time>
        </p>
        <div className={styles.actions}>
          <TypeBadge type={session.type} />
          <ShareButton
            title={title}
            // The list filtered to this program, centre and day, so it shows live spots.
            href={hrefWith("/", EMPTY_SEARCH, {
              q: title,
              centreIds: [session.centreId],
              from: day,
              to: day,
            })}
          />
        </div>
      </div>
      <h3 className={styles.title}>
        {session.url ? <ExternalLink href={session.url}>{title}</ExternalLink> : title}
      </h3>
      <p className={styles.where}>
        <span aria-hidden="true">📍 </span>
        <Link
          className={styles.centre}
          href={centreHref}
          title={`Add ${session.centreName} to the filter`}
        >
          {session.centreName}
          <LinkPending />
        </Link>
        {session.facility && <span className={styles.facility}> · {session.facility}</span>}
      </p>
      {session.type === "enroll" && (
        <EnrollPanel activityId={session.activityId} cityUrl={session.url} />
      )}
    </article>
  );
}
