import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SearchSkeleton, SearchView } from "@/components/SearchView";
import { ALL_CENTRES, findCentre } from "@/lib/centres";

export function generateStaticParams() {
  return ALL_CENTRES.map((centre) => ({ id: String(centre.id) }));
}

export async function generateMetadata({ params }: PageProps<"/centres/[id]">): Promise<Metadata> {
  const centre = findCentre(Number((await params).id));
  return { title: centre?.name ?? "Centre not found" };
}

export default async function CentrePage({ params, searchParams }: PageProps<"/centres/[id]">) {
  const { id } = await params;
  const centre = findCentre(Number(id));
  if (!centre) notFound();

  return (
    <>
      <p className="breadcrumb">
        <Link href="/centres">Centres</Link>
      </p>
      <h1 className="page-title">{centre.name}</h1>
      <Suspense fallback={<SearchSkeleton />}>
        <SearchView searchParams={searchParams} path={`/centres/${centre.id}`} centre={centre} />
      </Suspense>
    </>
  );
}
