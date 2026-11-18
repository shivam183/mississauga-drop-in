import dropInCentres from "../../data/centres.dropin.json";
import enrollCentres from "../../data/centres.enroll.json";
import type { SessionType } from "@/models/session";

export interface Centre {
  id: number;
  name: string;
}

/**
 * Centres per calendar, from data/ (refreshed weekly by the update-centres
 * workflow), so loading a schedule doesn't need an extra request.
 */
export const CENTRES_BY_TYPE: Record<SessionType, readonly Centre[]> = {
  dropin: dropInCentres,
  enroll: enrollCentres,
};

/** Every centre in either calendar, sorted by name. */
export const ALL_CENTRES: readonly Centre[] = [
  ...new Map([...dropInCentres, ...enrollCentres].map((c) => [c.id, c])).values(),
].sort((a, b) => a.name.localeCompare(b.name, "en"));

/** "Mississauga Seniors' Centre" -> "mississauga-seniors-centre", for /centres/{slug}. */
export function centreSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The centre a page slug names, or undefined. */
export function centreBySlug(slug: string): Centre | undefined {
  return ALL_CENTRES.find((c) => centreSlug(c.name) === slug);
}

/** A centre's page, or null if it isn't a known centre. */
export function centrePath(id: number): string | null {
  const centre = ALL_CENTRES.find((c) => c.id === id);
  return centre ? `/centres/${centreSlug(centre.name)}` : null;
}
