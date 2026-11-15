import { Suspense } from "react";
import { ExternalLink } from "@/components/ExternalLink";
import { SearchSkeleton, SearchView } from "@/components/SearchView";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <h1 className="page-title">What&rsquo;s on at Mississauga community centres</h1>
      <p className="muted intro">
        Drop-in and enroll-online sessions from{" "}
        <ExternalLink href="https://anc.ca.apm.activecommunities.com/activemississauga/home">
          ActiveMississauga
        </ExternalLink>
        , with live spots left.
      </p>
      <Suspense fallback={<SearchSkeleton />}>
        <SearchView searchParams={searchParams} path="/" />
      </Suspense>
    </>
  );
}
