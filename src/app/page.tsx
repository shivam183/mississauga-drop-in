import Link from "next/link";
import { Suspense } from "react";
import { ExternalLink } from "@/components/ExternalLink";
import { SearchSkeleton, SearchView } from "@/components/SearchView";
import { ALL_CENTRES, centreSlug } from "@/lib/centres";
import { ACTIVITIES } from "@/models/activities";

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
      {/* For people and crawlers: the landing pages. Chips and the centre filter stay in place. */}
      <nav className="browse" aria-labelledby="browse">
        <h2 id="browse">Browse</h2>
        <div>
          <h3>By activity</h3>
          <ul>
            {ACTIVITIES.map(({ slug, label }) => (
              <li key={slug}>
                <Link href={`/${slug}`}>{label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>By centre</h3>
          <ul>
            {ALL_CENTRES.map(({ id, name }) => (
              <li key={id}>
                <Link href={`/centres/${centreSlug(name)}`}>{name}</Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}
