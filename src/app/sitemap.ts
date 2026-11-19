import type { MetadataRoute } from "next";
import { ALL_CENTRES, centreSlug } from "@/lib/centres";
import { ACTIVITIES } from "@/models/activities";

const SITE_URL = "https://mississaugadropin.com";

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
