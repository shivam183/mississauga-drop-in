import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ExternalLink } from "@/components/ExternalLink";
import { SearchSkeleton, SearchView } from "@/components/SearchView";
import { getActivity } from "@/lib/activity";
import { ALL_CENTRES, centreBySlug, centreSlug } from "@/lib/centres";
import { toTorontoLocal } from "@/lib/dates";
import { getSchedule } from "@/lib/schedule";

// One static page per centre; any other slug is a notFound() below, as on /[activity].
export function generateStaticParams() {
  return ALL_CENTRES.map(({ name }) => ({ slug: centreSlug(name) }));
}

export async function generateMetadata(
  { params }: PageProps<"/centres/[slug]">,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const centre = centreBySlug((await params).slug);
  if (!centre) notFound();
  const title = `${centre.name} drop-ins and programs`;
  const description = `Upcoming drop-in and enroll-online sessions at ${centre.name}, Mississauga, with times and spots left. Unofficial; not affiliated with the City of Mississauga.`;
  const url = `/centres/${centreSlug(centre.name)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { ...(await parent).openGraph, title, description, url },
  };
}

/** A landing page for one centre: its name and address, then the list filtered to it. */
export default function CentrePage(props: PageProps<"/centres/[slug]">) {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <CentreBody {...props} />
    </Suspense>
  );
}

async function CentreBody({ params, searchParams }: PageProps<"/centres/[slug]">) {
  const centre = centreBySlug((await params).slug);
  if (!centre) notFound();
  return (
    <>
      <h1 className="page-title">{centre.name}</h1>
      <p className="muted intro">
        All upcoming drop-in and enroll-online sessions at {centre.name}.
        <Suspense>
          <CentreContact centreId={centre.id} />
        </Suspense>
      </p>
      <Suspense fallback={<SearchSkeleton />}>
        {/* Controls link to "/", so the first filter change moves to the main list. */}
        <SearchView searchParams={searchParams} path="/" defaults={{ centreIds: [centre.id] }} />
      </Suspense>
    </>
  );
}

/**
 * Address and phone from the City's details of the centre's next session
 * (a drop-in if any: their details are cached a day). Left out if there's none.
 */
async function CentreContact({ centreId }: { centreId: number }) {
  const { sessions } = await getSchedule();
  await connection();
  const now = toTorontoLocal(new Date());
  const here = sessions.filter((s) => s.centreId === centreId && s.end > now);
  const next = here.find((s) => s.type === "dropin") ?? here[0];
  const info = next && (await getActivity(next.activityId))?.info?.centre;
  if (!info?.address) return null;
  const tel = info.phone.replace(/[^\d+]/g, "");
  const listing = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${info.name}, ${info.address}`)}`;
  return (
    <>
      <br />
      <ExternalLink href={listing}>{info.address}</ExternalLink>
      {tel && (
        <>
          {" · "}
          <a href={`tel:${tel}`}>{info.phone}</a> (City of Mississauga)
        </>
      )}
    </>
  );
}
