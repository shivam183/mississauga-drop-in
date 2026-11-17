import { foldText } from "./filters";

export interface Activity {
  /** Its page: /swim. */
  slug: string;
  /** The search it runs, matched against titles the way the search box is ("swim": Lane Swim, Leisure Swim). */
  q: string;
  /** The chip. */
  label: string;
  /** Its page's H1 and title. */
  h1: string;
  /** Its page's meta description. */
  description: string;
  /** One line under the H1. */
  intro: string;
}

function activity(slug: string, q: string, label: string, h1: string, what: string): Activity {
  return {
    slug,
    q,
    label,
    h1,
    description: `Upcoming ${what} at Mississauga community centres, with times, centres and spots left. Unofficial; not affiliated with the City of Mississauga.`,
    intro: `All upcoming ${what} at City of Mississauga community centres.`,
  };
}

/**
 * One-tap searches for the most common activities, each with its own page:
 * Pickleball first (the most popular), then busiest first.
 */
export const ACTIVITIES: Activity[] = [
  activity(
    "pickleball",
    "pickleball",
    "Pickleball",
    "Drop-in pickleball in Mississauga",
    "pickleball drop-ins",
  ),
  activity(
    "swim",
    "swim",
    "Swim",
    "Drop-in swimming in Mississauga",
    "public, lane and leisure swims",
  ),
  activity("yoga", "yoga", "Yoga", "Drop-in yoga in Mississauga", "yoga classes"),
  activity("skate", "skate", "Skate", "Public skating in Mississauga", "public skating sessions"),
  activity(
    "hockey",
    "hockey",
    "Hockey",
    "Drop-in hockey in Mississauga",
    "shinny and drop-in hockey sessions",
  ),
  activity(
    "basketball",
    "basketball",
    "Basketball",
    "Drop-in basketball in Mississauga",
    "basketball drop-ins",
  ),
  activity(
    "badminton",
    "badminton",
    "Badminton",
    "Drop-in badminton in Mississauga",
    "badminton drop-ins",
  ),
  activity(
    "volleyball",
    "volleyball",
    "Volleyball",
    "Drop-in volleyball in Mississauga",
    "volleyball drop-ins",
  ),
  activity(
    "table-tennis",
    "table tennis",
    "Table tennis",
    "Drop-in table tennis in Mississauga",
    "table tennis drop-ins",
  ),
  activity("soccer", "soccer", "Soccer", "Drop-in soccer in Mississauga", "soccer drop-ins"),
];

/** The activity a page slug names ("swim"), or undefined. */
export function activityBySlug(slug: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.slug === slug);
}

/** The chip a session title belongs to ("Adult Leisure Swim" -> swim), matched the way search is. */
export function activityFor(title: string): Activity | null {
  const folded = foldText(title);
  const i = FOLDED.findIndex((q) => folded.includes(q));
  return i < 0 ? null : ACTIVITIES[i];
}

const FOLDED = ACTIVITIES.map(({ q }) => foldText(q));
