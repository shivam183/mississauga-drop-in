import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getProgram, type ProgramDetails as Details } from "@/lib/registered";
import { iconFor, iconTint } from "@/models/activities";
import { spotsLeftText } from "@/models/availability";
import { formatDateSpan, type Fee } from "@/models/registered";
import { facts, Notes, WhereRow } from "./ActivityDetails";
import styles from "./ActivityDetails.module.css";
import { DETAILS_TITLE_ID } from "./detailsIds";
import { PreviewShown } from "./DetailsPreview";
import { EnrollButton } from "./EnrollButton";
import { ExternalLink } from "./ExternalLink";
import { ShareButton } from "./ShareButton";
import { TypeBadge } from "./TypeBadge";

/** Both /registered/{id} routes: the popup and the full page. */
export type RegisteredRouteProps = { params: Promise<{ id: string }> };

/** "170708" -> 170708; anything else -> NaN (getProgram then returns null, the not-found page). */
export const parseRegisteredId = (raw: string) => (/^\d{1,12}$/.test(raw) ? Number(raw) : NaN);

/** Loads the program for a route (or shows not-found) and renders its details. */
export async function RegisteredDetailsRoute({
  params,
  close,
  page = false,
}: RegisteredRouteProps & { close: ReactNode; page?: boolean }) {
  const { id } = await params;
  const program = await getProgram(parseRegisteredId(id));
  if (!program) notFound();
  return <RegisteredDetails program={program} close={close} page={page} />;
}

/** "6 spots left", "Full", or nothing when the City doesn't say. */
function spotsText({ spaces }: Details): string {
  if (spaces.level === "full") return "Full";
  if (spaces.level === "unknown") return "";
  return spotsLeftText(spaces.count);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Fees as a table. "Resident, member" … "Non-resident, non-member" become a
 * grid (residency by membership); anything else is one row per fee.
 */
function FeeTable({ fees }: { fees: Fee[] }) {
  const pairs = fees.map((f) => f.label.split(/\s*,\s*/));
  const grid = pairs.every((p) => p.length === 2);
  const rows = grid ? [...new Set(pairs.map((p) => p[0]))] : [];
  const cols = grid ? [...new Set(pairs.map((p) => p[1]))] : [];
  const price = (row: string, col: string) =>
    fees[pairs.findIndex((p) => p[0] === row && p[1] === col)]?.price ?? "–";
  // A grid only when it has more than one column and every cell is filled.
  if (grid && cols.length > 1 && rows.length * cols.length === fees.length) {
    return (
      <table className={styles.fees}>
        <thead>
          <tr>
            <th scope="col">Fees</th>
            {cols.map((c) => (
              <th key={c} scope="col">
                {capitalize(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <th scope="row">{r}</th>
              {cols.map((c) => (
                <td key={c}>{price(r, c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <table className={styles.fees}>
      <thead>
        <tr>
          <th scope="col">Fees</th>
          <th scope="col">Price</th>
        </tr>
      </thead>
      <tbody>
        {fees.map((f) => (
          <tr key={`${f.label}${f.price}`}>
            <th scope="row">{f.label || "Fee"}</th>
            <td>{f.price}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * A program's popup content, also the full /registered/{id} page: when it
 * meets, fees, spots, what it is and where, with Enroll pinned at the bottom.
 */
export function RegisteredDetails({
  program,
  close,
  page = false,
}: {
  program: Details;
  close: ReactNode;
  /** The full page: the name is the page's h1. */
  page?: boolean;
}) {
  const { info, meetings, fees, enroll } = program;
  const centreName = info.centre?.name ?? "";
  const Heading = page ? "h1" : "h2";
  const factList = facts(info);
  const spots = spotsText(program);
  const dates = formatDateSpan(info.firstDate, info.lastDate);
  const when = meetings.length > 0 ? meetings : dates ? [{ time: "", dates }] : [];
  const icon = iconFor(info.name);
  const tint = iconTint(icon);
  const firstWhen = when[0] ? [when[0].time, when[0].dates].filter(Boolean).join(" · ") : "";

  return (
    <>
      <PreviewShown />
      <div className={styles.head}>
        <TypeBadge type="program" />
        <div className={styles.headActions}>
          <ShareButton
            className={styles.iconLink}
            title={info.name}
            text={[info.name, firstWhen, centreName].filter(Boolean).join("\n")}
            href={`/registered/${program.id}`}
          />
          {close}
        </div>
      </div>
      <div className={styles.body}>
        <Heading id={DETAILS_TITLE_ID} className={styles.name}>
          {icon && (
            <span aria-hidden="true" className={styles.nameIcon} data-tint={tint}>
              {icon}
            </span>
          )}
          {info.name}
        </Heading>
        {factList.length > 0 && (
          <ul className={styles.facts} aria-label="About this program">
            {factList.map((f) => (
              <li key={f.text} className={f.age ? `${styles.fact} ${styles.age}` : styles.fact}>
                {f.age && <span aria-hidden="true">👤 </span>}
                {f.text}
              </li>
            ))}
          </ul>
        )}

        <section className={styles.session} data-tint={tint} aria-label="When and where">
          {/* Spots sit top right, on the label's line, like the card's top row. */}
          <div className={styles.labelRow}>
            <p className={styles.label}>
              {info.sessionCount && info.sessionCount > 1 ? `${info.sessionCount} classes` : "When"}
            </p>
            {spots && (
              <span className={styles.spotsCount} data-level={program.spaces.level}>
                {spots}
              </span>
            )}
          </div>
          {when.map((m) => (
            <div key={`${m.time}|${m.dates}`}>
              {m.time && <p className={styles.when}>{m.time}</p>}
              {m.dates && <p className={styles.meetingDates}>{m.dates}</p>}
            </div>
          ))}
          {centreName && (
            <WhereRow
              centreName={centreName}
              info={info}
              calendarHref={
                program.calendar.length > 0 ? `/registered/${program.id}/calendar` : undefined
              }
            />
          )}
        </section>

        {fees.length > 0 && (
          <section className={styles.feesSection} aria-label="Fees">
            <FeeTable fees={fees} />
            {program.plan && (
              <p className={styles.plan}>
                <strong>Payment plan:</strong> {program.plan}
              </p>
            )}
            <p className={styles.summary}>
              What you pay depends on residency and memberships; ActiveMississauga shows your price
              when you enroll.
            </p>
          </section>
        )}

        {info.description && (
          <section aria-labelledby="details-about">
            <h3 id="details-about" className={styles.heading}>
              About
            </h3>
            <p className={styles.text}>{info.description}</p>
          </section>
        )}

        {info.notes && (
          <section aria-labelledby="details-notes">
            <h3 id="details-notes" className={styles.heading}>
              Good to know
            </h3>
            <Notes text={info.notes} />
          </section>
        )}
      </div>

      <div className={styles.bar}>
        <EnrollButton
          state={enroll}
          cityUrl={program.cityUrl}
          reminderHref={`/registered/${program.id}/reminder`}
        />
        {/* "unknown" already shows "Check on ActiveMississauga"; under a real button this is a plain link. */}
        {enroll.state !== "unknown" && (
          <ExternalLink
            className={
              enroll.state === "enroll" || enroll.state === "opens"
                ? styles.cityLink
                : styles.cityButton
            }
            href={program.cityUrl}
          >
            View on ActiveMississauga <span aria-hidden="true">↗</span>
          </ExternalLink>
        )}
      </div>
    </>
  );
}
