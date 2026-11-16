import type { LocalDateTime } from "@/lib/activenet/types";
import { formatDayHeading } from "@/lib/format";
import type { PageDay } from "@/models/filters";
import { DayDetails } from "./DayDetails";
import styles from "./DayGroup.module.css";
import searchStyles from "./Search.module.css";
import { SessionCard } from "./SessionCard";

/**
 * Sessions for one day under a sticky "Today · Sat Nov 14" heading. Tapping the
 * heading collapses the day; a collapsed day comes from the server with no cards.
 */
export function DayGroup({
  group,
  now,
  centreHref,
}: {
  group: PageDay;
  /** Toronto time, "YYYY-MM-DD HH:mm:ss". */
  now: LocalDateTime;
  centreHref: (centreId: number) => string;
}) {
  const today = now.slice(0, 10);
  const id = `day-${group.date}`;
  return (
    <section className={styles.group} aria-labelledby={id}>
      <DayDetails
        date={group.date}
        collapsed={group.collapsed}
        className={styles.details}
        summaryClassName={styles.heading}
        summary={
          <>
            <h2 id={id} className={styles.title}>
              {formatDayHeading(group.date, today)}
            </h2>
            <span className={styles.chevron} aria-hidden="true" />
          </>
        }
      >
        {group.collapsed && (
          // Hidden while collapsed; shows only if the day is reopened, until its cards arrive.
          <div role="status" aria-busy="true">
            <span className="visually-hidden">Loading…</span>
            {/* The same placeholder cards as the first page load. */}
            <div className={`${searchStyles.cardSkeleton} shimmer`} />
            <div className={`${searchStyles.cardSkeleton} shimmer`} />
          </div>
        )}
        {group.sessions.length > 0 && (
          <ol className={styles.list}>
            {group.sessions.map((session) => (
              <li key={session.id}>
                <SessionCard
                  session={session}
                  centreHref={centreHref(session.centreId)}
                  now={now}
                />
              </li>
            ))}
          </ol>
        )}
      </DayDetails>
    </section>
  );
}
