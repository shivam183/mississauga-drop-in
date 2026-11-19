import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import styles from "@/components/ActivityDetails.module.css";
import { CloseIcon } from "@/components/CloseIcon";
import { DetailsLoading, RestoreList } from "@/components/DetailsPreview";
import {
  parseRegisteredId,
  RegisteredDetailsRoute,
  type RegisteredRouteProps,
} from "@/components/RegisteredDetails";
import { getProgram } from "@/lib/registered";

export async function generateMetadata({ params }: RegisteredRouteProps): Promise<Metadata> {
  const { id } = await params;
  // Shared with the page body within this request (getProgram is cached per request).
  const program = await getProgram(parseRegisteredId(id));
  // The not-found page (with noindex); status 200, as for /activity/{id}.
  if (!program) notFound();
  const { info } = program;
  const where = info.centre?.name ? ` at ${info.centre.name}` : "";
  return {
    title: `${info.name}${where}`,
    description: info.description.slice(0, 200) || `${info.name}${where}, Mississauga.`,
    // Programs change every season, so they aren't search pages.
    robots: { index: false, follow: true },
    alternates: { canonical: `/registered/${id}` },
  };
}

/** A program's details as a full page: a shared link, a refresh, or no JavaScript. */
export default function RegisteredPage(props: RegisteredRouteProps) {
  // No history to go back to here, so ✕ is a plain link to the list.
  const close = (
    <Link
      href="/registered"
      className={styles.close}
      aria-label="Close, show all programs"
      title="All programs"
    >
      <CloseIcon />
    </Link>
  );
  return (
    <div className={styles.page}>
      <RestoreList />
      <Suspense fallback={<DetailsLoading close={close} />}>
        <RegisteredDetailsRoute {...props} close={close} page />
      </Suspense>
    </div>
  );
}
