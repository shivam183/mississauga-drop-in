import type { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SearchSkeleton, SearchView } from "@/components/SearchView";
import { ACTIVITIES, activityBySlug } from "@/models/activities";

// One static page per activity. `dynamicParams = false` isn't allowed with
// Cache Components, so any other slug is a notFound() below.
export function generateStaticParams() {
  return ACTIVITIES.map(({ slug }) => ({ activity: slug }));
}

export async function generateMetadata(
  { params }: PageProps<"/[activity]">,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const activity = activityBySlug((await params).activity);
  if (!activity) notFound();
  const { h1, description, slug } = activity;
  return {
    title: h1,
    description,
    alternates: { canonical: `/${slug}` },
    openGraph: { ...(await parent).openGraph, title: h1, description, url: `/${slug}` },
  };
}

/** A landing page for one activity: its H1, then the list with its search filled in. */
export default function ActivityTypePage(props: PageProps<"/[activity]">) {
  // params inside <Suspense> keeps navigation instant; the listed slugs still
  // prerender their H1 into the static HTML.
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <ActivityTypeBody {...props} />
    </Suspense>
  );
}

async function ActivityTypeBody({ params, searchParams }: PageProps<"/[activity]">) {
  const activity = activityBySlug((await params).activity);
  if (!activity) notFound();
  return (
    <>
      <h1 className="page-title">{activity.h1}</h1>
      <p className="muted intro">{activity.intro}</p>
      <Suspense fallback={<SearchSkeleton />}>
        {/* Controls link to "/", so the first filter change moves to the main list. */}
        <SearchView searchParams={searchParams} path="/" defaults={{ q: activity.q }} />
      </Suspense>
    </>
  );
}
