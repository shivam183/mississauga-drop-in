import type { Metadata, ResolvingMetadata } from "next";
import { Suspense } from "react";
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
      {/* TITLE stays the tab and search title ("Registered programs in Mississauga"). */}
      <h1 className="page-title">Find your next registered program</h1>
      <p className="muted intro">
        Lessons, camps and leagues you sign up for once for the season, with spots left and fees.
      </p>
      <Suspense fallback={<SearchSkeleton />}>
        <RegisteredView searchParams={searchParams} />
      </Suspense>
    </>
  );
}
