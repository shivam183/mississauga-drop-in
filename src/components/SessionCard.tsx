import Link from "next/link";
import type { LocalDateTime } from "@/lib/activenet/types";
import { displayTitle, formatDate, formatTimeRange, sessionWhen, startsLabel } from "@/lib/format";
import { EMPTY_SEARCH, hrefWith } from "@/lib/params";
import { iconFor } from "@/models/activities";
import type { Session } from "@/models/session";
import { CalendarLink } from "./CalendarLink";
import { DetailsLink } from "./DetailsPreview";
import { EnrollPanel } from "./EnrollPanel";
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
  const icon = iconFor(session.title);
  return (
    <article className={styles.card} aria-label={`${title}, ${time}`}>
      <div className={styles.top}>
        <p className={styles.time}>
          <time dateTime={session.start.replace(" ", "T")}>{time}</time>
        </p>
        <div className={styles.actions}>
          <TypeBadge type={session.type} />
          <CalendarLink
            href={`/activity/${session.activityId}/calendar?session=${session.id}`}
            className={styles.calendar}
          />
          <ShareButton
            title={title}
            text={[title, `${formatDate(day)}, ${time}`, session.centreName].join("\n")}
            // Opens our list showing just this session, with live spots and Enroll.
            href={hrefWith("/", EMPTY_SEARCH, { session: session.id })}
          />
        </div>
      </div>
      {soon && (
        <p className={styles.soon} data-tone={soon.tone}>
          {soon.text}
        </p>
      )}
      <h3 className={styles.title}>
        {icon && <span aria-hidden="true">{icon} </span>}
        {/* Opens the details popup, which shows this card's name, time and place straight away. */}
        <DetailsLink
          preview={{
            href: `/activity/${session.activityId}?session=${session.id}`,
            type: session.type,
            title,
            when: sessionWhen(session.start, session.end, now.slice(0, 10)),
            where: session.facility
              ? `${session.centreName} · ${session.facility}`
              : session.centreName,
          }}
        >
          {title}
        </DetailsLink>
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
