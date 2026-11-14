import { Suspense } from "react";
import { SearchSkeleton, SearchView } from "@/components/SearchView";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <h1 className="page-title">Drop-in and enrol-online programs</h1>
      <p className="muted intro">
        Every session at Mississauga&rsquo;s community centres, soonest first. Enrol-online sessions
        show live spots left.
      </p>
      <Suspense fallback={<SearchSkeleton />}>
        <SearchView searchParams={searchParams} path="/" />
      </Suspense>
    </>
  );
}
