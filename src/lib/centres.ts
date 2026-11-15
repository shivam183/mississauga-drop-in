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
