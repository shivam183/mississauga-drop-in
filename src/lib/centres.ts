import dropInCentres from "../../data/centres.dropin.json";
import enrollCentres from "../../data/centres.enroll.json";
import locations from "../../data/centre-locations.json";
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

/** A place, in degrees. */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Where each centre is, for "Near me".
 * shortcut: captured once from the City's activity details (Nov 2026), not by
 * the weekly update-centres job, so a new centre has no location and "Near me"
 * leaves it out; add it to data/centre-locations.json (or to that job) then.
 */
const CENTRE_LOCATION = new Map(
  Object.entries(locations).map(([id, [lat, lng]]) => [Number(id), { lat, lng }]),
);

/** Straight-line distance in km between two places (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Each located centre's distance in km from `from`. */
export function centreDistances(from: LatLng): Map<number, number> {
  return new Map([...CENTRE_LOCATION].map(([id, at]) => [id, distanceKm(from, at)]));
}
