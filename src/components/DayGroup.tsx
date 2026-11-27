import type { LocalDateTime } from "@/lib/activenet/types";
import { formatDayHeading, weekday } from "@/lib/format";
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
  // "Today · Sat Nov 14" -> "Today" and "Sat Nov 14": the first part is styled, the text stays the same.
  const label = formatDayHeading(group.date, today);
  const sep = label.indexOf(" · ");
  const lead = sep < 0 ? null : label.slice(0, sep);
  const date = sep < 0 ? label : label.slice(sep + 3);
  const weekend = [0, 6].includes(weekday(group.date));
  const band = lead === "Today" ? styles.today : weekend ? styles.weekend : "";
  return (
    <section className={styles.group} aria-labelledby={id}>
      <DayDetails
        date={group.date}
        collapsed={group.collapsed}
        summaryClassName={`${styles.heading} ${band}`}
        summary={
          <>
            <h2 id={id} className={styles.title}>
              {weekend && lead !== "Today" && (
                // Decoration: the date already says Sat or Sun.
                <span className={`${styles.pill} ${styles.weekendPill}`} aria-hidden="true">
                  Weekend
                </span>
              )}
              {lead && (
                <>
                  <span
                    className={`${styles.pill} ${lead === "Tomorrow" ? styles.tomorrowPill : ""}`}
                  >
                    {lead}
                  </span>
                  {/* Read as "Today · Sat Nov 14", as before; the pill stands in for the dot on screen. */}
                  <span className="visually-hidden"> · </span>
                </>
              )}
              {date}
            </h2>
            <span className={styles.chevron} aria-hidden="true" />
          </>
        }
      >
        {group.collapsed ? (
          // Hidden while collapsed; shows only if the day is reopened, until its cards arrive.
          <div role="status" aria-busy="true">
            <span className="visually-hidden">Loading…</span>
            <div className={`${searchStyles.cardSkeleton} shimmer`} />
            <div className={`${searchStyles.cardSkeleton} shimmer`} />
          </div>
        ) : (
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
