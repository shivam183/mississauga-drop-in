import Link from "next/link";
import { displayTitle, formatTimeRange } from "@/lib/format";
import type { Session } from "@/models/session";
import { EnrolPanel } from "./EnrolPanel";
import { ExternalLink } from "./ExternalLink";
import styles from "./SessionCard.module.css";
import { TypeBadge } from "./TypeBadge";

/** One result. Time first and largest, centre second, then spots and Enrol for "enrol" sessions. */
export function SessionCard({ session }: { session: Session }) {
  const title = displayTitle(session.title);
  return (
    <article
      className={styles.card}
      aria-label={`${title}, ${formatTimeRange(session.start, session.end)}`}
    >
      <div className={styles.top}>
        <p className={styles.time}>
          <time dateTime={session.start.replace(" ", "T")}>
            {formatTimeRange(session.start, session.end)}
          </time>
        </p>
        <TypeBadge type={session.type} />
      </div>
      <h3 className={styles.title}>
        {session.url ? <ExternalLink href={session.url}>{title}</ExternalLink> : title}
      </h3>
      <p className={styles.where}>
        <span aria-hidden="true">📍 </span>
        <Link className={styles.centre} href={`/centres/${session.centreId}`}>
          {session.centreName}
        </Link>
        {session.facility && <span className={styles.facility}> · {session.facility}</span>}
      </p>
      {session.type === "enrol" && (
        <EnrolPanel activityId={session.activityId} cityUrl={session.url} />
      )}
    </article>
  );
}
