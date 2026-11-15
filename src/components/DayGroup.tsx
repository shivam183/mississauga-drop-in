import { formatDayHeading } from "@/lib/format";
import type { DayGroup as Group } from "@/models/filters";
import styles from "./DayGroup.module.css";
import { SessionCard } from "./SessionCard";

/** Sessions for one day under a sticky "Today · Sat Nov 14" heading. */
export function DayGroup({
  group,
  today,
  centreHref,
}: {
  group: Group;
  today: string;
  centreHref: (centreId: number) => string;
}) {
  const id = `day-${group.date}`;
  return (
    <section className={styles.group} aria-labelledby={id}>
      <h2 id={id} className={styles.heading}>
        {formatDayHeading(group.date, today)}
      </h2>
      <ol className={styles.list}>
        {group.sessions.map((session) => (
          <li key={session.id}>
            <SessionCard session={session} centreHref={centreHref(session.centreId)} />
          </li>
        ))}
      </ol>
    </section>
  );
}
