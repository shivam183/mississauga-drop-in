/**
 * Safety helpers for anything that came from the City's API and ends up in
 * the page: links must point at the City's ActiveNet site, and notices are
 * shown as plain text only.
 */

/** Returns the URL if it is https on *.activecommunities.com, otherwise null. */
export function safeCityUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const allowed = host === "activecommunities.com" || host.endsWith(".activecommunities.com");
  if (url.protocol !== "https:" || !allowed || url.username || url.password || url.port) {
    return null;
  }
  return url.toString();
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
};

function decodeEntity(entity: string, name: string): string {
  if (name.startsWith("#")) {
    const code =
      name[1] === "x" || name[1] === "X"
        ? parseInt(name.slice(2), 16)
        : parseInt(name.slice(1), 10);
    return Number.isInteger(code) &&
      code > 0 &&
      code <= 0x10ffff &&
      (code < 0xd800 || code > 0xdfff)
      ? String.fromCodePoint(code)
      : entity;
  }
  return ENTITIES[name.toLowerCase()] ?? entity;
}

/**
 * Turns a City notice (sometimes HTML, e.g. "<div>This activity is full…</div>")
 * into plain text. The result is rendered as text, never as markup.
 */
export function noticeToText(value: unknown): string {
  if (typeof value !== "string") return "";
  // Until nothing changes, so no pass can leave a new tag behind. Each pass
  // only shortens the text, so this ends.
  let text = value;
  let before;
  do {
    before = text;
    text = text
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h\d)\s*>/gi, " ")
      .replace(/<[^>]*>/g, "");
  } while (text !== before);
  // A tag start with no ">" after it ("Hi <script") survives the loop; a plain "a < b" stays.
  text = text.replace(/<(?=[a-z/!?])/gi, "");
  // Entities last, so an escaped "&lt;b&gt;" stays the text "<b>".
  return text
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, decodeEntity)
    .replace(/\s+/g, " ")
    .trim();
}
