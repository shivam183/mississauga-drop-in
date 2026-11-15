import Link from "next/link";
import type { LocalDateTime } from "@/lib/activenet/types";
import { displayTitle, formatDate, formatTimeRange, startsLabel } from "@/lib/format";
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
  now,
}: {
  session: Session;
  /** Where the centre name goes: the list filtered to that centre. */
  centreHref: string;
  /** Toronto time when the page was rendered, for "On now" / "Starts in". */
  now: LocalDateTime;
}) {
  const title = displayTitle(session.title);
  const time = formatTimeRange(session.start, session.end);
  const day = session.start.slice(0, 10);
  // shortcut: computed at render time, so it can be a few minutes stale if the page sits open; move to a client tick if users notice.
  const soon = startsLabel(session.start, session.end, now);
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
            text={[title, `${formatDate(day)}, ${time}`, session.centreName].join("\n")}
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
      {soon && (
        <p className={styles.soon} data-tone={soon.tone}>
          {soon.text}
        </p>
      )}
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
