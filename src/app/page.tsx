import Link from "next/link";
import { Suspense } from "react";
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
      <h1 className="page-title">Find your next drop-in</h1>
      {/* The footer credits ActiveMississauga and says we're unofficial. */}
      <p className="muted intro">
        Swim, skate, pickleball and more at {ALL_CENTRES.length} City centres, with live spots left.
      </p>
      <Suspense fallback={<SearchSkeleton />}>
        <SearchView searchParams={searchParams} path="/" />
      </Suspense>
      {/* For people and crawlers: the landing pages. Chips and the centre filter stay in place. */}
      <nav className="browse" aria-labelledby="browse">
        <h2 id="browse">Browse</h2>
        <h3>By activity</h3>
        <ul className="browse-list">
          {ACTIVITIES.map(({ slug, label }) => (
            <li key={slug}>
              <Link href={`/${slug}`}>{label}</Link>
            </li>
          ))}
        </ul>
        <h3>By centre</h3>
        <ul className="browse-list">
          {ALL_CENTRES.map(({ id, name }) => (
            <li key={id}>
              <Link href={`/centres/${centreSlug(name)}`}>{name}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
