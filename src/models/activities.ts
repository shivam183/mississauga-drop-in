import { foldText } from "./filters";

/**
 * One-tap searches for the most common activities: Pickleball first (the most
 * popular), then busiest first. Each `q` matches every variant of the City's
 * titles ("skat": Skate, Figure Skating).
 */
export const ACTIVITIES: Array<[q: string, label: string]> = [
  ["pickleball", "Pickleball"],
  ["swim", "Swim"],
  ["yoga", "Yoga"],
  ["skat", "Skate"],
  ["hockey", "Hockey"],
  ["basketball", "Basketball"],
  ["badminton", "Badminton"],
  ["volleyball", "Volleyball"],
  ["table tennis", "Table tennis"],
  ["soccer", "Soccer"],
];

/** The chip a session title belongs to ("Adult Leisure Swim" -> swim), matched the way search is. */
export function activityFor(title: string): [q: string, label: string] | null {
  const folded = foldText(title);
  const i = FOLDED.findIndex((q) => folded.includes(q));
  return i < 0 ? null : ACTIVITIES[i];
}

const FOLDED = ACTIVITIES.map(([q]) => foldText(q));
