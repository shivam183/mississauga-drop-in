import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getActivity, type Activity } from "@/lib/activity";
import { centrePath } from "@/lib/centres";
import {
  displayTitle,
  formatDate,
  formatMonthDay,
  formatTimeRange,
  sessionWhen,
  startsLabel,
  weekdayName,
} from "@/lib/format";
import { EMPTY_SEARCH, hrefWith } from "@/lib/params";
import { activityFor, iconFor } from "@/models/activities";
import type { ActivityInfo } from "@/models/activity";
import type { Session } from "@/models/session";
import styles from "./ActivityDetails.module.css";
import { DETAILS_TITLE_ID } from "./detailsIds";
import { DetailsEnrollButton, DetailsSpots } from "./DetailsEnroll";
import { PreviewShown } from "./DetailsPreview";
import { ExternalLink } from "./ExternalLink";
import { MapsMenu, type MapApp } from "./MapsMenu";
import { ShareButton } from "./ShareButton";
import { TypeBadge } from "./TypeBadge";

/** "167139" -> 167139; anything else -> NaN (getActivity then returns null, the not-found page). */
export function parseActivityId(raw: string): number {
  return /^\d{1,12}$/.test(raw) ? Number(raw) : NaN;
}

/** Both /activity/{id} routes: the popup and the full page. */
export type ActivityRouteProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Loads the activity for a route (or shows not-found) and renders its details. */
export async function ActivityDetailsRoute({
  params,
  searchParams,
  close,
  page = false,
}: ActivityRouteProps & { close: ReactNode; page?: boolean }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const activity = await getActivity(parseActivityId(id));
  if (!activity) notFound();
  const session = typeof query.session === "string" ? query.session : undefined;
  return <ActivityDetails activity={activity} selectedId={session} close={close} page={page} />;
}

const UPCOMING = 4;

export function facts(info: ActivityInfo | null): Array<{ text: string; age?: boolean }> {
  if (!info) return [];
  const season =
    info.season && info.firstDate && info.lastDate && info.firstDate !== info.lastDate
      ? `${info.season} · ${formatMonthDay(info.firstDate)} – ${formatMonthDay(info.lastDate)}`
      : info.season;
  return [
    { text: info.category },
    // "Ages 16+", but "All ages" as the City says it.
    { text: /^\d/.test(info.ages) ? `Ages ${info.ages}` : info.ages, age: true },
    { text: info.gender },
    { text: season },
  ].filter((f) => f.text);
}

/** "Every Tuesday until Dec 29 · 9 sessions this season", or as much of it as is known. */
function runSummary(sessions: Session[], info: ActivityInfo | null): string {
  const days = new Set(sessions.map((s) => weekdayName(s.start.slice(0, 10))));
  const every =
    sessions.length > 1 && days.size === 1 && info?.lastDate
      ? `Every ${[...days][0]} until ${formatMonthDay(info.lastDate)}`
      : "";
  const count =
    info?.sessionCount && info.sessionCount > 1 ? `${info.sessionCount} sessions this season` : "";
  return [every, count].filter(Boolean).join(" · ");
}

/**
 * The centre for a maps app. Name and address find the app's own listing
 * (photos, hours); coordinates only drop a bare pin, so they're the fallback
 * without an address.
 */
function mapPlace(centreName: string, info: ActivityInfo | null): string {
  const centre = info?.centre;
  const name = centre?.name ?? centreName;
  if (centre?.address) return `${name}, ${centre.address}`;
  if (centre?.lat != null && centre.lng != null) return `${centre.lat},${centre.lng}`;
  return `${name}, Mississauga, ON`;
}

/** Directions in each maps app, for the Directions menu. */
function mapApps(centreName: string, info: ActivityInfo | null): MapApp[] {
  const place = encodeURIComponent(mapPlace(centreName, info));
  const { lat, lng } = info?.centre ?? {};
  return [
    {
      id: "google",
      label: "Google Maps",
      href: `https://www.google.com/maps/dir/?api=1&destination=${place}`,
    },
    { id: "apple", label: "Apple Maps", href: `https://maps.apple.com/?daddr=${place}` },
    {
      id: "waze",
      label: "Waze",
      // Waze's search is weaker than its coordinates.
      href:
        lat != null && lng != null
          ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
          : `https://waze.com/ul?q=${place}&navigate=yes`,
    },
  ];
}

/** "Churchill Meadows Community Centre" -> "Churchill Meadows" */
const shortCentre = (name: string) => name.replace(/\s+(Community|Recreation) Centre$/i, "");

/**
 * The details popup's content, also the full /activity/{id} page. `selectedId`
 * is the session that was tapped (Session.id); otherwise the next one.
 */
export function ActivityDetails({
  activity,
  selectedId,
  close,
  page = false,
}: {
  activity: Activity;
  /** The full page: the name is the page's h1. */
  page?: boolean;
  selectedId?: string;
  /** The ✕: back in the popup, a link to the list on the full page. */
  close: ReactNode;
}) {
  const { sessions, info, now } = activity;
  const shown = sessions.find((s) => s.id === selectedId) ?? sessions[0];
  const name = info?.name || displayTitle(shown.title);
  const soon = startsLabel(shown.start, shown.end, now);
  const others =
    shown.type === "dropin" ? sessions.filter((s) => s !== shown).slice(0, UPCOMING) : [];
  const summary = shown.type === "dropin" ? runSummary(sessions, info) : "";
  const chip = activityFor(shown.title);
  const icon = iconFor(shown.title);
  const enroll = shown.type === "enroll";
  const Heading = page ? "h1" : "h2";
  const factList = facts(info);

  return (
    <>
      <PreviewShown />
      <div className={styles.head}>
        <TypeBadge type={shown.type} />
        <div className={styles.headActions}>
          <ShareButton
            className={styles.iconLink}
            title={name}
            text={[
              name,
              sessionWhen(shown.start, shown.end, now.slice(0, 10)),
              shown.centreName,
            ].join("\n")}
            // This page: whoever opens it gets these details (the full page).
            href={`/activity/${shown.activityId}?session=${shown.id}`}
          />
          {close}
        </div>
      </div>
      <div className={styles.body}>
        <Heading id={DETAILS_TITLE_ID} className={styles.name}>
          {icon && <span aria-hidden="true">{icon} </span>}
          {name}
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

        <section className={styles.session} aria-label="This session">
          <p className={styles.label}>{shown === sessions[0] ? "Next" : "Session"}</p>
          <p className={styles.when}>
            <time dateTime={shown.start.replace(" ", "T")}>
              {sessionWhen(shown.start, shown.end, now.slice(0, 10))}
            </time>
            {soon && (
              <span className={styles.soon} data-tone={soon.tone}>
                {" "}
                {soon.text}
              </span>
            )}
          </p>
          <WhereRow centreName={shown.centreName} facility={shown.facility} info={info} />
          {enroll && <DetailsSpots activityId={shown.activityId} className={styles.spots} />}
        </section>

        {others.length > 0 && (
          <section aria-labelledby="details-upcoming">
            <h3 id="details-upcoming" className={styles.heading}>
              Upcoming
            </h3>
            <ul className={styles.upcoming}>
              {others.map((s) => (
                <li key={s.id}>
                  <span>{formatDate(s.start.slice(0, 10))}</span>
                  <span>{formatTimeRange(s.start, s.end)}</span>
                </li>
              ))}
            </ul>
            {summary && <p className={styles.summary}>{summary}</p>}
          </section>
        )}

        {info?.description && (
          <section aria-labelledby="details-about">
            <h3 id="details-about" className={styles.heading}>
              About
            </h3>
            <p className={styles.text}>{info.description}</p>
          </section>
        )}

        {info?.notes && (
          <section aria-labelledby="details-notes">
            <h3 id="details-notes" className={styles.heading}>
              Good to know
            </h3>
            <p className={styles.notes}>{info.notes}</p>
          </section>
        )}

        <section aria-labelledby="details-more">
          <h3 id="details-more" className={styles.heading}>
            See more
          </h3>
          <div className={styles.more}>
            {chip && (
              <Link className={styles.pill} href={`/${chip.slug}`}>
                More {chip.label.toLowerCase()} sessions <span aria-hidden="true">→</span>
              </Link>
            )}
            <Link
              className={styles.pill}
              href={
                centrePath(shown.centreId) ??
                hrefWith("/", EMPTY_SEARCH, { centreIds: [shown.centreId] })
              }
            >
              More at {shortCentre(shown.centreName)} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </div>

      <div className={styles.bar}>
        {enroll && <DetailsEnrollButton activityId={shown.activityId} cityUrl={shown.url} />}
        {shown.url && (
          <ExternalLink className={enroll ? styles.cityLink : styles.cityButton} href={shown.url}>
            View on ActiveMississauga <span aria-hidden="true">↗</span>
          </ExternalLink>
        )}
      </div>
    </>
  );
}

const DIRECTIONS_ICON = "M3 11l18-8-8 18-2-8z";
const PHONE_ICON =
  "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z";

/**
 * "📍 Centre · Room" with Directions (a maps-app menu) and Call beside it; the
 * details card of a drop-in and of a registered program.
 */
export function WhereRow({
  centreName,
  facility = "",
  info,
}: {
  centreName: string;
  facility?: string;
  info: ActivityInfo | null;
}) {
  const phone = info?.centre?.phone ?? "";
  const tel = phone.replace(/[^\d+]/g, "");
  return (
    <div className={styles.whereRow}>
      <p className={styles.where}>
        <span aria-hidden="true">📍 </span>
        {centreName}
        {facility && ` · ${facility}`}
      </p>
      <span className={styles.quick}>
        <MapsMenu apps={mapApps(centreName, info)} label={`Directions to ${centreName}`}>
          <Icon d={DIRECTIONS_ICON} />
        </MapsMenu>
        {tel && (
          <a
            href={`tel:${tel}`}
            className={styles.iconLink}
            aria-label={`Call ${phone}`}
            title={`Call ${phone}`}
          >
            <Icon d={PHONE_ICON} />
          </a>
        )}
      </span>
    </div>
  );
}

/** A 20px outline icon in the current text colour. */
function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
