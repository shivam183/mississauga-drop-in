import type { RawDetailCentre } from "@/lib/activenet/types";

/**
 * Each centre's own front desk, by ActiveNet centre id, as shown on its page at
 * mississauga.ca/recreation-and-sports/locations/ (checked 2026-11-26). The
 * City's API gives (905) 615-4100, the general line, for every centre.
 * shortcut: hand-kept; recheck when a centre is added or a number stops working.
 */
const CENTRE_PHONES: Record<number, string> = {
  290: "905-615-4630", // Burnhamthorpe Community Centre
  248: "905-615-4800", // Carmen Corbasson Community Centre
  261: "905-615-4701", // Churchill Meadows Community Centre
  240: "905-615-4840", // Clarkson Community Centre
  403: "905-615-4840", // Clarkson Library (in the community centre)
  267: "905-615-4750", // Erin Meadows Community Centre
  250: "905-615-4760", // Erin Mills Twin Arena
  243: "905-615-4660", // Frank McKechnie Community Centre
  252: "905-615-4820", // Huron Park Recreation Centre
  253: "905-615-4680", // Iceland Arena
  125: "905-615-4640", // Malton Community Centre
  65: "905-615-4701", // Mattamy Sports Park (shares Churchill Meadows' page)
  100: "905-615-4730", // Meadowvale 4 Rinks
  119: "905-615-4710", // Meadowvale Community Centre
  401: "905-615-4810", // Mississauga Seniors' Centre
  91: "905-615-3200 ext 2895", // Sportsplex
  82: "905-615-4670", // Mississauga Valley Community Centre
  396: "905-615-4670", // Mississauga Valley Gymnasium (no page; the community centre's)
  128: "905-615-4640", // Paul Coffey Arena
  106: "905-615-4830", // Port Credit Memorial Arena
  110: "905-615-4780", // River Grove Community Centre
};

/** The centre's own number if we know it, else what the City sent (often the general line). */
export function centrePhone(centre: RawDetailCentre | null | undefined): string {
  const own = typeof centre?.id === "number" ? CENTRE_PHONES[centre.id] : undefined;
  const sent = typeof centre?.phone === "string" ? centre.phone.replace(/\s+/g, " ").trim() : "";
  return own ?? sent;
}

/** "905-615-3200 ext 2895" -> "tel:9056153200,2895" (the comma dials the extension). */
export function telHref(phone: string): string {
  const [number, ext] = phone.split(/\s*ext\.?\s*/i);
  const digits = (s: string) => s.replace(/[^\d+]/g, "");
  return `tel:${digits(number)}${ext ? `,${digits(ext)}` : ""}`;
}
