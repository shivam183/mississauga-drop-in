import phones from "../../data/centres.phones.json";
import type { RawDetailCentre } from "@/lib/activenet/types";

/** Each centre's own front desk, by ActiveNet centre id; `npm run update-phones` refreshes it. */
const CENTRE_PHONES: Record<string, string> = phones;

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
