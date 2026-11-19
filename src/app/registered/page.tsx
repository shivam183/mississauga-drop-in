import type { Metadata, ResolvingMetadata } from "next";
import { Suspense } from "react";
import { ExternalLink } from "@/components/ExternalLink";
import { RegisteredView } from "@/components/RegisteredView";
import { SearchSkeleton } from "@/components/SearchView";

const TITLE = "Registered programs in Mississauga";
const DESCRIPTION =
  "Swimming lessons, camps, sports, fitness and arts programs you register for at Mississauga community centres, with spots left and fees.";

export async function generateMetadata(_: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  return {
    title: TITLE,
    description: DESCRIPTION,
    // Filter URLs (?q=, ?age=…) are the same page to search engines.
    alternates: { canonical: "/registered" },
    openGraph: {
      ...(await parent).openGraph,
      title: TITLE,
      description: DESCRIPTION,
      url: "/registered",
    },
  };
}

/** Registered programs: sign up once for a season (the Drop-in tab is for single visits). */
export default function ProgramsPage({ searchParams }: PageProps<"/registered">) {
  return (
    <>
      <h1 className="page-title">{TITLE}</h1>
      <p className="muted intro">
        Lessons, camps and leagues you sign up for once for the season, from{" "}
        <ExternalLink href="https://anc.ca.apm.activecommunities.com/activemississauga/activity/search">
          ActiveMississauga
        </ExternalLink>
        , with spots left and fees.
      </p>
      <Suspense fallback={<SearchSkeleton />}>
        <RegisteredView searchParams={searchParams} />
      </Suspense>
    </>
  );
}
