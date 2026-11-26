import type { MetadataRoute } from "next";
import { ALL_CENTRES, centreSlug } from "@/lib/centres";
import { SITE_URL } from "@/lib/site";
import { ACTIVITIES } from "@/models/activities";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "/",
    "/registered",
    ...ACTIVITIES.map(({ slug }) => `/${slug}`),
    ...ALL_CENTRES.map(({ name }) => `/centres/${centreSlug(name)}`),
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "hourly",
  }));
}
