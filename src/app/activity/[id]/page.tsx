import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ActivityDetailsRoute,
  parseActivityId,
  type ActivityRouteProps,
} from "@/components/ActivityDetails";
import styles from "@/components/ActivityDetails.module.css";
import { DetailsLoading, RestoreList } from "@/components/DetailsPreview";
import { CloseIcon } from "@/components/CloseIcon";
import { getActivity } from "@/lib/activity";
import { displayTitle } from "@/lib/format";

export async function generateMetadata({ params }: ActivityRouteProps): Promise<Metadata> {
  const { id } = await params;
  // Shared with the page body within this request (getActivity is cached per request).
  const activity = await getActivity(parseActivityId(id));
  // The not-found page (with noindex). The status stays 200: the page shell is
  // prerendered and sent before this lookup runs.
  if (!activity) notFound();
  const { info, sessions } = activity;
  const name = info?.name || displayTitle(sessions[0].title);
  const centre = info?.centre?.name ?? sessions[0].centreName;
  return {
    title: `${name} at ${centre}`,
    description:
      info?.description.slice(0, 200) || `Upcoming times for ${name} at ${centre}, Mississauga.`,
    // Details change every season, so they aren't search pages (see PLAN, Phase 7).
    robots: { index: false, follow: true },
    alternates: { canonical: `/activity/${id}` },
  };
}

/** The details as a full page: a shared link, a refresh, or no JavaScript. */
export default function ActivityPage(props: ActivityRouteProps) {
  // No history to go back to here, so ✕ is a plain link to the list.
  const close = (
    <Link
      href="/"
      className={styles.close}
      aria-label="Close, show all sessions"
      title="All sessions"
    >
      <CloseIcon />
    </Link>
  );
  return (
    <div className={styles.page}>
      <RestoreList />
      <Suspense fallback={<DetailsLoading close={close} />}>
        <ActivityDetailsRoute {...props} close={close} page />
      </Suspense>
    </div>
  );
}
