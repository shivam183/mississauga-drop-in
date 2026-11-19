import type { RawActivityDetail } from "@/lib/activenet/types";
import { displayTitle } from "@/lib/format";
import { noticeToText } from "./links";

/** What the details popup shows about an activity. Plain data, so it can be cached. */
export interface ActivityInfo {
  name: string;
  /** "Recreational Swim". Empty if unknown. */
  category: string;
  /** "16+", "6–12". Empty if unknown. */
  ages: string;
  /** "Female" or "Male"; empty when mixed or unknown. */
  gender: string;
  /** "Fall 2026". Empty if unknown. */
  season: string;
  /** "YYYY-MM-DD", or empty. */
  firstDate: string;
  lastDate: string;
  description: string;
  /** Plain text, never markup. */
  notes: string;
  centre: ActivityCentre | null;
  /** Sessions in the whole run, if the City says. */
  sessionCount: number | null;
}

export interface ActivityCentre {
  name: string;
  /** "5320 Ninth Line, Mississauga, ON L5M 0R5". Empty if unknown. */
  address: string;
  phone: string;
  lat: number | null;
  lng: number | null;
}

const text = (value: unknown) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
const coordinate = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value !== 0 ? value : null;
const isoDate = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";

/**
 * "16 yrs +," -> "16+"; "6 yrs - 12 yrs" -> "6–12"; programs' "Age at least
 * 18 yrs but less than 100 yrs" -> "18+" and "… 3 yrs but less than 5 yrs" -> "3–4";
 * anything else as given.
 */
export function formatAges(description: unknown): string {
  // Decoded: the City sends "4&#189;" for 4½.
  const raw = noticeToText(description).replace(/[\s,]+$/, "");
  const plus = raw.match(/^(\d+)\s*(?:yrs?\s*\+|and up)$/i);
  if (plus) return `${plus[1]}+`;
  // Details say "Age at least 3 yrs but …", search rows "At least 3 but …".
  // "Less than 100" is the City's "no upper limit". Months stay: "4y 9m–14".
  const atLeast = raw.match(
    /^(?:Age\s+)?at least\s+(\d+½?(?:\s*yrs?)?|\d+y(?:\s*\d+m)?)\s+but less than\s+(\d+)\s*(?:yrs?)?$/i,
  );
  if (atLeast) {
    // Details say "4y 6m" where search rows say "4½"; show "4½" for both.
    const from = atLeast[1]
      .replace(/\s*yrs?$/i, "")
      .replace(/^(\d+)y\s*6m$/i, "$1½")
      .replace(/\s+/g, " ");
    const to = Number(atLeast[2]) - 1;
    return to >= 98 ? `${from}+` : `${from}–${to}`;
  }
  const range = raw.match(/^(\d+)\s*(?:yrs?)?\s*-\s*(\d+)\s*yrs?$/i);
  if (range) return `${range[1]}–${range[2]}`;
  return raw;
}

/** "2026 Fall" -> "Fall 2026". */
function formatSeason(name: unknown): string {
  const raw = text(name);
  const match = raw.match(/^(\d{4})\s+(.+)$/);
  return match ? `${match[2]} ${match[1]}` : raw;
}

/** The City's wording on every drop-in, one sentence each. */
const DROP_IN_BOILERPLATE =
  /This is a Drop-?in Program for informational purposes only\.?|NO REGISTRATIONS? (?:are|is) to be processed for this program\.?|Entry is on a first come[- ]first served? basis(?: on program capacity)?\.?/gi;

export const NO_REGISTRATION =
  "No registration. Entry is first come, first served while there’s room.";

/**
 * Notes as plain text. The City's drop-in boilerplate is said plainly instead;
 * anything else in the note is kept as written, after it.
 */
function formatNotes(online: unknown, user: unknown): string {
  const notes = noticeToText(text(online) ? online : user);
  if (!DROP_IN_BOILERPLATE.test(notes)) return notes;
  DROP_IN_BOILERPLATE.lastIndex = 0; // a /g regex keeps its position between calls
  // What's left once the boilerplate (and the stray dots around it) is gone.
  const rest = notes
    .replace(DROP_IN_BOILERPLATE, " ")
    .replace(/(\s*\.)+(\s|$)/g, ".$2")
    .replace(/^[\s.]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return [NO_REGISTRATION, rest].filter(Boolean).join(" ");
}

export function toActivityInfo(detail: RawActivityDetail): ActivityInfo {
  const centre = detail.centers?.[0];
  const centreName = text(centre?.name);
  const gender = text(detail.allowed_gender);
  const cityLine = [
    text(centre?.city),
    [text(centre?.state), text(centre?.zip_code)].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const count = detail.other_info?.sessions;
  return {
    name: displayTitle(text(detail.activity_name)),
    category: text(detail.category),
    ages: formatAges(detail.age_description),
    gender: /^mixed$/i.test(gender) ? "" : gender,
    season: formatSeason(detail.season_name),
    firstDate: isoDate(detail.first_date),
    lastDate: isoDate(detail.last_date),
    // Often wrapped in pasted HTML (<span style=…>, &nbsp;).
    description: noticeToText(detail.catalog_description),
    notes: formatNotes(detail.online_notes, detail.user_notes),
    centre: centreName
      ? {
          name: centreName,
          address: [text(centre?.address1), text(centre?.address2), cityLine]
            .filter(Boolean)
            .join(", "),
          phone: text(centre?.phone),
          lat: coordinate(centre?.latitude),
          lng: coordinate(centre?.longitude),
        }
      : null,
    sessionCount: typeof count === "number" && count > 0 ? count : null,
  };
}
