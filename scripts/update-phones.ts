/**
 * Refreshes data/centres.phones.json: each centre's own front-desk number, by
 * ActiveNet centre id, from its page at mississauga.ca/recreation-and-sports/locations/.
 * The City's API gives (905) 615-4100, the general line, for every centre.
 * Fails if a page is gone or has no number, so a moved page shows up as a
 * failed run. Run weekly by .github/workflows/update-centres.yml.
 *
 *   npm run update-phones
 */
import path from "node:path";
import { locationPhone, run, writeJson } from "./lib";

const BASE_URL = "https://www.mississauga.ca/recreation-and-sports/locations/";

/** Centre id -> its page. shortcut: hand-kept; add a line when a centre is added. */
const PAGES: Record<number, string> = {
  290: "burnhamthorpe-community-centre",
  248: "carmen-corbasson-community-centre",
  261: "churchill-meadows-community-centre-and-mattamy-sports-park",
  240: "clarkson-community-centre",
  403: "clarkson-community-centre", // Clarkson Library (in the community centre)
  267: "erin-meadows-community-centre",
  250: "erin-mills-twin-arena",
  243: "frank-mckechnie-community-centre",
  252: "huron-park-recreation-centre",
  253: "iceland-arena",
  125: "malton-community-centre",
  65: "churchill-meadows-community-centre-and-mattamy-sports-park", // Mattamy Sports Park
  100: "meadowvale-4-rinks",
  119: "meadowvale-community-centre",
  401: "mississauga-seniors-centre",
  91: "mississauga-sports-and-entertainment-centre-sportsplex",
  82: "mississauga-valley-community-centre",
  396: "mississauga-valley-community-centre", // Mississauga Valley Gymnasium (no page of its own)
  128: "paul-coffey-arena",
  106: "port-credit-memorial-arena",
  110: "river-grove-community-centre",
};

run(async () => {
  const bySlug = new Map<string, string>();
  const phones: Record<string, string> = {};
  for (const [id, slug] of Object.entries(PAGES)) {
    let phone = bySlug.get(slug);
    if (phone === undefined) {
      const response = await fetch(`${BASE_URL}${slug}/`);
      if (!response.ok) throw new Error(`${slug}: HTTP ${response.status}`);
      const found = locationPhone(await response.text());
      if (!found) throw new Error(`${slug}: no phone number we can read on the page`);
      phone = found;
      bySlug.set(slug, phone);
    }
    phones[id] = phone;
  }
  const file = path.resolve("data/centres.phones.json");
  await writeJson(file, phones);
  console.log(`${Object.keys(phones).length} centre phones -> ${file}`);
});
