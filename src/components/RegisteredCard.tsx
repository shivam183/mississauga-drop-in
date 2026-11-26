import { iconFor } from "@/models/activities";
import { spotsLeftText, type EnrollState } from "@/models/availability";
import { agesLabel, type Program } from "@/models/registered";
import { DetailsLink } from "./DetailsPreview";
import { EnrollButton } from "./EnrollButton";
import styles from "./RegisteredCard.module.css";
import cardStyles from "./SessionCard.module.css";
import { ShareButton } from "./ShareButton";

/**
 * One registered program, compact: when it meets and its dates (with spots and
 * Share), the name, the centre and ages, then a full-width Enroll at
 * the bottom like an enroll-online session. No badge: the tab already says
 * Registered. No fee: it depends on residency and membership (the popup lists them).
 */
export function RegisteredCard({ program }: { program: Program }) {
  const { status } = program;
  const when = [program.days, program.time].filter(Boolean).join(" ") || program.dates;
  const dates = when === program.dates ? "" : program.dates;
  const level = status.state === "full" ? "full" : status.few ? "few" : "open";
  const spots = status.state === "full" ? "Full" : spotsLeftText(status.spots);
  const whenLine = [when, dates].filter(Boolean).join(" · ");
  const icon = iconFor(program.name);
  const state: EnrollState =
    status.state === "full"
      ? { state: "full" }
      : !program.enrollUrl
        ? { state: "unknown" }
        : status.state === "opens"
          ? { state: "opens", opensAt: status.at, url: program.enrollUrl }
          : { state: "enroll", url: program.enrollUrl };
  return (
    // The spots' data-level gives the card its stripe or faded look (SessionCard.module.css).
    <article className={cardStyles.card} aria-label={program.name}>
      <div className={cardStyles.top}>
        <p className={styles.when}>{when}</p>
        <div className={cardStyles.actions}>
          <span className={styles.spots} data-level={level}>
            {spots}
          </span>
          <ShareButton
            title={program.name}
            text={[program.name, whenLine, program.centre].filter(Boolean).join("\n")}
            // Its details page: whoever opens it gets the full page.
            href={`/registered/${program.id}`}
          />
        </div>
      </div>
      {/* For a program, the dates matter as much as the time: right under it. */}
      {(dates || program.started) && (
        <p className={styles.dates}>
          {dates}
          {program.started && <span className={styles.started}> · Started</span>}
        </p>
      )}
      <h3 className={`${cardStyles.title} ${styles.name}`}>
        {icon && <span aria-hidden="true">{icon} </span>}
        {/* Opens the details popup, which shows this card's name and times straight away. */}
        <DetailsLink
          preview={{
            href: `/registered/${program.id}`,
            type: "program",
            title: program.name,
            when: whenLine,
            where: program.centre,
          }}
        >
          {program.name}
        </DetailsLink>
      </h3>
      <p className={cardStyles.where}>
        <span aria-hidden="true">📍 </span>
        {program.centre}
      </p>
      {program.ages && <p className={styles.ages}>{agesLabel(program.ages)}</p>}
      {state.state !== "full" && (
        <div className={styles.enroll}>
          <EnrollButton state={state} cityUrl={program.cityUrl} />
        </div>
      )}
    </article>
  );
}
