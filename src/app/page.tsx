import { Suspense } from "react";
import { ExternalLink } from "@/components/ExternalLink";
import { SearchSkeleton, SearchView } from "@/components/SearchView";

// Tells Google the site's name for search results.
const WEBSITE_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Mississauga Drop-In",
  alternateName: "mississaugadropin.com",
  url: "https://mississaugadropin.com/",
});

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: WEBSITE_JSON_LD }} />
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
