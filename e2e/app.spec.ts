import { expect, test, type Page } from "@playwright/test";

const isPhone = (projectName: string) => projectName === "phone";

/** A real touch swipe from (x, y), `dy` px down (Playwright's mouse makes no touch events). */
async function touchSwipe(page: Page, x: number, y: number, dy: number) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", at: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y: at }],
    });
  await touch("touchStart", y);
  for (let i = 1; i <= 6; i++) await touch("touchMove", y + (dy * i) / 6);
  await touch("touchEnd", y + dy);
  await cdp.detach();
}

/** Tests that behave the same at every size run once, at desktop size (see playwright.config.ts). */
const ANY_SIZE = { tag: "@any-size" };

/** The first "enroll online" card on /?type=enroll is the mock's open session; the second is full. */
async function enrollCards(page: Page) {
  await page.goto("/?type=enroll");
  return page.getByRole("article");
}

test("the page never scrolls sideways", async ({ page }) => {
  for (const url of ["/", "/?type=enroll", "/?centre=290&time=morning"]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow on ${url}`).toBeLessThanOrEqual(0);
  }
});

test("results are grouped by day and lead with time and centre", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: /^Tomorrow · / })).toBeVisible();
  const card = page.getByRole("article").first();
  await expect(card.locator("time")).toHaveText(/^\d{1,2}:\d{2}( [AP]M)? – \d{1,2}:\d{2} [AP]M$/);
  await expect(card.getByRole("link", { name: "Burnhamthorpe Community Centre" })).toBeVisible();
});

test(
  "Share copies a link to this session where the browser can't share",
  ANY_SIZE,
  async ({ page }) => {
    // No share sheet (as on most desktops), and a clipboard we can read back.
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "share", { value: undefined });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async (t: string) => ((window as { copied?: string }).copied = t) },
      });
    });
    await page.goto("/");
    const card = page.getByRole("article").first();
    // The card is labelled "<title>, <time>".
    const title = (await card.getAttribute("aria-label"))!.split(",")[0];
    await card.getByRole("button", { name: `Share ${title}` }).click();
    await expect(card.getByRole("status")).toHaveText("Copied");

    const copied = (await page.evaluate(() => (window as { copied?: string }).copied))!;
    // One detail per line, then the link on its own line.
    const [name, when, centre, url] = copied.split("\n");
    expect(name).toBe(title);
    expect(when).toMatch(/^\w{3} \w{3} \d{1,2}, \d{1,2}:\d{2}/);
    expect(centre).toBe("Burnhamthorpe Community Centre");
    // The link shows just that one session, with a way back to everything.
    expect(url).toMatch(/\/\?session=[de]\d+-\d{12}$/);
    await page.goto(url);
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("article")).toHaveAttribute(
      "aria-label",
      new RegExp(`^${title}, `),
    );
    await expect(page.getByText("Shared session")).toBeVisible();
    await page.getByRole("link", { name: "Show all sessions" }).click();
    await expect(page).not.toHaveURL(/session=/);
    await expect(page.getByRole("article").nth(1)).toBeVisible();
  },
);

test("a shared link to a session that has ended says so", ANY_SIZE, async ({ page }) => {
  await page.goto("/?session=d1-200001010000");
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(
    page.getByText("This shared session has ended or is no longer listed."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Show all sessions" })).toHaveAttribute("href", "/");
});

test("the Type filter narrows the list and lives in the URL", async ({ page }, testInfo) => {
  await page.goto("/");
  if (isPhone(testInfo.project.name)) await page.getByRole("button", { name: /^Filters/ }).click();
  const type = page.getByRole("region", { name: "Filters" }).getByLabel("Type");
  await type.selectOption("enroll");
  await expect(page).toHaveURL(/[?&]type=enroll\b/);
  await expect(type).toHaveValue("enroll");
  await expect(page.getByRole("article").first().getByText("Enroll online")).toBeVisible();
  await expect(page.getByRole("article").getByText("Drop-in", { exact: true })).toHaveCount(0);
});

test("the filters in use show as pills that each remove their filter", async ({
  page,
}, testInfo) => {
  await page.goto("/?type=enroll&time=morning,evening");
  const pills = page.getByRole("list", { name: "Filters in use" });
  await expect(pills.getByRole("link")).toHaveText(["Enroll online✕", "Morning✕", "Evening✕"]);
  await pills.getByRole("link", { name: "Remove Morning" }).click();
  await expect(page).toHaveURL(/\/\?type=enroll&time=evening$/);
  // The form follows the URL: Morning is unticked, Evening still ticked.
  if (isPhone(testInfo.project.name)) await page.getByRole("button", { name: /^Filters/ }).click();
  const filters = page.getByRole("region", { name: "Filters" });
  await expect(filters.getByRole("checkbox", { name: /Morning/ })).not.toBeChecked();
  await expect(filters.getByRole("checkbox", { name: /Evening/ })).toBeChecked();
});

test("activity chips filter in place, keep other filters and toggle off", async ({ page }) => {
  await page.goto("/?type=dropin");
  const chips = page.getByRole("navigation", { name: "Activity" });
  await chips.getByRole("link", { name: "Swim" }).click();
  // The same page, not /swim: the list updates without swapping the whole view.
  await expect(page).toHaveURL(/:\d+\/\?(?=.*type=dropin)(?=.*q=swim)/);
  await expect(page.getByRole("searchbox")).toHaveValue("swim");
  await expect(chips.getByRole("link", { name: "Swim" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("article").first()).toContainText(/swim/i);

  await chips.getByRole("link", { name: "Swim" }).click();
  await expect(page).toHaveURL(/:\d+\/\?type=dropin$/);
  await expect(page.getByRole("searchbox")).toHaveValue("");
});

test("an activity page lists only its sessions; a new search moves to the main list", async ({
  page,
}) => {
  await page.goto("/swim");
  await expect(page).toHaveTitle("Drop-in swimming in Mississauga · Mississauga Drop-In");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/swim$/);
  await expect(page.getByRole("searchbox")).toHaveValue("swim");
  const cards = page.getByRole("article");
  await expect(cards.first()).toBeVisible();
  for (const label of await cards.evaluateAll((els) => els.map((e) => e.ariaLabel ?? ""))) {
    expect(label).toMatch(/swim/i);
  }

  // Typing searches the main list and the box keeps focus.
  const box = page.getByRole("searchbox");
  await box.selectText();
  await box.pressSequentially("lane", { delay: 50 });
  await expect(page).toHaveURL(/:\d+\/\?q=lane$/);
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(/swimming/);
  await expect(page.getByRole("searchbox")).toBeFocused();
});

test(
  "unknown activity slugs are 404s; the sitemap lists the activity pages",
  ANY_SIZE,
  async ({ page, request }) => {
    // Like /activity/{id}: the static shell is sent (200) before the slug is checked.
    for (const url of ["/frisbee", "/calendar", "/centres"]) {
      await page.goto(url);
      await expect(page.getByText(/could not be found/i), url).toBeVisible();
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
        "content",
        /noindex/,
      );
    }
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("<loc>https://mississaugadropin.com/</loc>");
    expect(sitemap).toContain("<loc>https://mississaugadropin.com/table-tennis</loc>");
  },
);

test("a centre page lists only its sessions, with its address; Browse links to it", async ({
  page,
}) => {
  await page.goto("/");
  const browse = page.getByRole("navigation", { name: "Browse" });
  await browse.getByRole("link", { name: "Swim" }).click();
  await expect(page).toHaveURL(/\/swim$/);
  await page.goBack();
  await browse.getByRole("link", { name: "Burnhamthorpe Community Centre" }).click();
  await expect(page).toHaveURL(/\/centres\/burnhamthorpe-community-centre$/);
  await expect(page).toHaveTitle(
    "Burnhamthorpe Community Centre drop-ins and programs · Mississauga Drop-In",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/centres\/burnhamthorpe-community-centre$/,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Burnhamthorpe Community Centre",
  );
  await expect(page.getByRole("link", { name: /1500 Gulleden Drive/ })).toBeVisible(); // the mock's detail
  const cards = page.getByRole("article");
  await expect(cards.first()).toBeVisible();
  const centres = await cards.evaluateAll((els) =>
    els.map((e) => e.querySelector('a[title$="to the filter"]')?.textContent),
  );
  expect(new Set(centres)).toEqual(new Set(["Burnhamthorpe Community Centre"]));
});

test(
  "unknown centre slugs are 404s; the sitemap lists the centre pages",
  ANY_SIZE,
  async ({ page, request }) => {
    for (const url of ["/centres/290", "/centres/nowhere"]) {
      await page.goto(url);
      await expect(page.getByText(/could not be found/i), url).toBeVisible();
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
        "content",
        /noindex/,
      );
    }
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(
      "<loc>https://mississaugadropin.com/centres/churchill-meadows-community-centre</loc>",
    );
  },
);

test(
  "searching starts as soon as typing pauses, with no Search button",
  ANY_SIZE,
  async ({ page }) => {
    await page.goto("/?type=dropin");
    await expect(page.getByRole("button", { name: "Search", exact: true })).toHaveCount(0);
    const box = page.getByRole("searchbox");
    await box.click();
    await box.pressSequentially("swim", { delay: 50 });

    // Not on every keystroke…
    expect(page.url()).not.toMatch(/[?&]q=/);

    // …but as soon as typing pauses. Other filters are kept.
    await expect(page).toHaveURL(/[?&]q=swim\b/, { timeout: 1500 });
    await expect(page).toHaveURL(/[?&]type=dropin\b/);
    await expect(page.getByRole("article").first()).toContainText(/swim/i);
    await expect(box).toBeFocused();
    await expect(box).toHaveValue("swim");
  },
);

test("Enter searches straight away", ANY_SIZE, async ({ page }) => {
  await page.goto("/");
  const box = page.getByRole("searchbox");
  await box.fill("pickleball");
  const started = Date.now();
  await box.press("Enter");
  await expect(page).toHaveURL(/[?&]q=pickleball\b/);
  expect(Date.now() - started).toBeLessThan(1500);

  // Clearing the box shows everything again.
  await box.fill("");
  await box.press("Enter");
  await expect(page).not.toHaveURL(/[?&]q=/);
});

test("the X button clears the search", ANY_SIZE, async ({ page }) => {
  await page.goto("/?type=dropin&q=swim");
  const box = page.getByRole("searchbox");
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page).not.toHaveURL(/[?&]q=/);
  await expect(page).toHaveURL(/[?&]type=dropin\b/);
  await expect(box).toHaveValue("");
  await expect(box).not.toBeFocused(); // no keyboard popping up on phones
  await expect(page.getByRole("button", { name: "Clear search" })).toHaveCount(0);
});

test(
  "an open session shows spots left, when they were checked, and Enroll now",
  ANY_SIZE,
  async ({ page }) => {
    const cards = await enrollCards(page);
    const first = cards.first();
    await expect(first.getByText(/^\d+ spots? left$/)).toBeVisible();
    await expect(first.getByText(/as of \d{1,2}:\d{2} [ap]m/)).toBeVisible();
    const enroll = first.getByRole("link", { name: /Enroll now/ });
    await expect(enroll).toHaveAttribute(
      "href",
      /^https:\/\/[^/]+\.activecommunities\.com\/.+\/enroll\/\d+/,
    );
    // Opens the City's page in a new tab, so this list stays open.
    await expect(enroll).toHaveAttribute("target", "_blank");
    await expect(enroll).toHaveAttribute("rel", /noopener/);
    await expect(enroll).toHaveAccessibleName(/opens in a new tab/);
  },
);

test("a full session says Full and has no Enroll button", ANY_SIZE, async ({ page }) => {
  const second = (await enrollCards(page)).nth(1);
  await expect(second.getByText("Full", { exact: true })).toBeVisible();
  await expect(second.getByRole("link", { name: /Enroll now/ })).toHaveCount(0);
  await expect(second.getByRole("link", { name: /ActiveMississauga/ })).toHaveCount(0);
});

test("the refresh button fetches a new count", ANY_SIZE, async ({ page }) => {
  const first = (await enrollCards(page)).first();
  const spots = first.getByText(/^\d+ spots? left$/);
  await expect(spots).toBeVisible();
  const before = parseInt((await spots.textContent())!, 10);

  const refreshed = page.waitForResponse(
    (r) => r.url().includes("/api/availability") && r.url().includes("fresh=1"),
  );
  await first.getByRole("button", { name: "Refresh spots left" }).click();
  expect((await refreshed).status()).toBe(200);
  await expect(spots).not.toHaveText(`${before} ${before === 1 ? "spot" : "spots"} left`);
  expect(parseInt((await spots.textContent())!, 10)).toBeLessThan(before);
});

test("Clear filters also drops a date range and centres that came from a link", async ({
  page,
}, testInfo) => {
  await page.goto("/?type=dropin&from=2030-01-01&to=2030-01-31&centre=290&time=morning");
  const sheet = page.getByRole("region", { name: "Filters" });
  if (isPhone(testInfo.project.name)) await page.getByRole("button", { name: /^Filters/ }).click();
  const day = sheet.getByLabel("Day");
  await expect(day.locator('option[value="keep"]')).toHaveCount(1);
  await expect(sheet.getByRole("list", { name: "Chosen centres" })).toBeVisible();

  await sheet.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).not.toHaveURL(/[?&](type|from|to|centre|time)=/);
  await expect(day).toHaveValue("any");
  await expect(day.locator('option[value="keep"]')).toHaveCount(0);
  await expect(sheet.getByRole("list", { name: "Chosen centres" })).toHaveCount(0);
  await expect(sheet.getByRole("checkbox", { name: "Morning" })).not.toBeChecked();
});

test("on phones, swiping down on the filter form at its top closes the sheet; lists inside still scroll", async ({
  page,
}, testInfo) => {
  test.skip(!isPhone(testInfo.project.name), "phone only");
  await page.goto("/");
  await hydrated(page);
  const button = page.getByRole("button", { name: /^Filters/ });
  const sheet = page.getByRole("region", { name: "Filters" });
  await button.click();
  await expect(sheet).toBeVisible();

  // A scrolled centre list: a swipe down in it scrolls the list, the sheet stays.
  await sheet.getByLabel("Community centre").click();
  const list = sheet.getByRole("listbox", { name: "Community centres" });
  await expect(list).toBeVisible();
  await list.evaluate((l) => (l.scrollTop = 120));
  const inList = (await list.boundingBox())!;
  await touchSwipe(page, inList.x + 40, inList.y + 30, 150);
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape"); // closes the list only
  await expect(list).toBeHidden();
  await expect(sheet).toBeVisible();

  // The form itself, at its top: the sheet follows the finger and closes.
  const field = (await sheet.getByText("Time of day").boundingBox())!;
  await touchSwipe(page, field.x + 20, field.y + field.height / 2, 150);
  await expect(sheet).toBeHidden();
});

test("the desktop sidebar can't be dragged like the phone sheet", async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo.project.name), "desktop only");
  await page.goto("/");
  const sheet = page.getByRole("region", { name: "Filters" });
  const title = (await sheet.getByRole("heading", { name: "Filters" }).boundingBox())!;
  await page.mouse.move(title.x + 5, title.y + 5);
  await page.mouse.down();
  await page.mouse.move(title.x + 5, title.y + 150);
  await expect(sheet).not.toHaveAttribute("style", /translateY/);
  await page.mouse.up();
});

test("filters: bottom sheet on phones, sidebar on desktop", async ({ page }, testInfo) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: /^Filters/ });
  const sheet = page.getByRole("region", { name: "Filters" });

  if (isPhone(testInfo.project.name)) {
    // An icon on the same row as the search box.
    const icon = (await button.boundingBox())!;
    const search = (await page.getByRole("searchbox").boundingBox())!;
    expect(icon.width).toBeLessThanOrEqual(48);
    expect(Math.abs(icon.y - search.y)).toBeLessThan(4);
    expect(icon.x).toBeGreaterThan(search.x + search.width);

    await expect(sheet).toBeHidden();
    await button.click();
    await expect(sheet).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    // Focus goes to the sheet, not a text field, so the phone keyboard stays down.
    await expect(sheet).toBeFocused();
    await expect(sheet.getByRole("combobox", { name: "Community centre" })).not.toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(button).toBeFocused();
    // No visible Close button: only a hidden one for keyboards and screen readers.
    await button.click();
    const srClose = sheet.getByRole("button", { name: "Close filters" });
    expect((await srClose.boundingBox())!.width).toBeLessThanOrEqual(1);
    await srClose.focus();
    expect((await srClose.boundingBox())!.width).toBeGreaterThan(1);
    await srClose.press("Enter");
    await expect(sheet).toBeHidden();

    // Tapping outside the sheet closes it.
    await button.click();
    await expect(sheet).toBeVisible();
    await page.mouse.click(180, 60);
    await expect(sheet).toBeHidden();

    // A short pull springs back; a longer swipe down closes it.
    await button.click();
    const title = (await sheet.getByRole("heading", { name: "Filters" }).boundingBox())!;
    const x = title.x + 20;
    const y = title.y + title.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 30, { steps: 5 });
    await page.mouse.up();
    await expect(sheet).toBeVisible();
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 150, { steps: 8 });
    await page.mouse.up();
    await expect(sheet).toBeHidden();
    await expect(button).toBeFocused();
    await button.click();
  } else {
    await expect(button).toBeHidden();
    await expect(sheet).toBeVisible();
  }

  // Each change applies at once, with no submit.
  await sheet.getByRole("checkbox", { name: "Morning" }).check();
  await expect(page).toHaveURL(/[?&]time=morning\b/);
  const day = sheet.getByLabel("Day");
  await expect(day).toHaveValue("any");
  await day.selectOption({ index: 2 });
  await expect(page).toHaveURL(/[?&]day=\d{4}-\d{2}-\d{2}\b/);
  await expect(page).toHaveURL(/[?&]time=morning\b/);
  await expect(page.locator('section[aria-labelledby^="day-"]')).toHaveCount(1); // just that day

  // No submit button with JavaScript on.
  await expect(sheet.getByRole("button", { name: "Show results" })).toHaveCount(0);
  if (isPhone(testInfo.project.name)) {
    // The sheet stays open while you filter; tap outside to see the results.
    await expect(sheet).toBeVisible();
    await page.mouse.click(180, 60);
    await expect(sheet).toBeHidden();
    await page.getByRole("button", { name: "Filters (2 on)" }).click();
  }
  await expect(sheet.getByRole("checkbox", { name: "Morning" })).toBeChecked();
  await expect(day).not.toHaveValue("any");

  // Clear filters is a button that resets every field as well as the results.
  const clear = sheet.getByRole("button", { name: "Clear filters" });
  await clear.click();
  await expect(page).not.toHaveURL(/[?&](time|day|centre)=/);
  await expect(sheet.getByRole("checkbox", { name: "Morning" })).not.toBeChecked();
  await expect(day).toHaveValue("any");
  await expect(sheet.getByRole("combobox", { name: "Community centre" })).toHaveValue("");
  await expect(page.locator('section[aria-labelledby^="day-"]').nth(1)).toBeVisible();
  await expect(clear).toBeDisabled(); // nothing left to clear
});

test("time-of-day chips show their hours", async ({ page }, testInfo) => {
  await page.goto("/");
  if (isPhone(testInfo.project.name)) await page.getByRole("button", { name: /^Filters/ }).click();
  const sheet = page.getByRole("region", { name: "Filters" });
  await expect(sheet.getByRole("checkbox", { name: "Morning until 12 PM" })).toBeVisible();
  await expect(sheet.getByRole("checkbox", { name: "Afternoon 12–5 PM" })).toBeVisible();
  await expect(sheet.getByRole("checkbox", { name: "Evening from 5 PM" })).toBeVisible();
});

test("the open centre picker fits inside the filters, with no sideways scroll", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await hydrated(page); // the picker only opens once the page is interactive
  const sheet = page.getByRole("region", { name: "Filters" });
  if (isPhone(testInfo.project.name)) await page.getByRole("button", { name: /^Filters/ }).click();
  await sheet.getByRole("combobox", { name: "Community centre" }).click();
  const list = sheet.getByRole("listbox", { name: "Community centres" });
  await expect(list).toBeVisible();
  expect(await sheet.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  // Long names wrap inside the list rather than widening it.
  const listBox = (await list.boundingBox())!;
  const sheetBox = (await sheet.boundingBox())!;
  expect(listBox.x + listBox.width).toBeLessThanOrEqual(sheetBox.x + sheetBox.width);
});

test("centre picker: type to filter the list, pick one or more centres", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await hydrated(page); // the picker only opens once the page is interactive
  const phone = isPhone(testInfo.project.name);
  const sheet = page.getByRole("region", { name: "Filters" });
  if (phone) await page.getByRole("button", { name: /^Filters/ }).click();
  const centre = sheet.getByRole("combobox", { name: "Community centre" });
  const list = sheet.getByRole("listbox", { name: "Community centres" });
  const chips = sheet.getByRole("list", { name: "Chosen centres" });

  // Clicking opens the full list, starting with "All centres"; it's multi-select.
  await centre.click();
  await expect(list).toBeVisible();
  await expect(list).toHaveAttribute("aria-multiselectable", "true");
  await expect(list.getByRole("option").first()).toHaveText("All centres");
  expect(await list.getByRole("option").count()).toBeGreaterThan(10);

  // Typing narrows the list; typing alone doesn't filter the results.
  await centre.pressSequentially("burn");
  await expect(list.getByRole("option")).toHaveText(["Burnhamthorpe Community Centre"]);
  expect(page.url()).not.toMatch(/centre=/);

  // Picking ticks it, applies at once, and keeps the list open for more.
  await list.getByRole("option", { name: "Burnhamthorpe Community Centre" }).click();
  await expect(page).toHaveURL(/[?&]centre=290\b/);
  await expect(list).toBeVisible();
  await expect(centre).toHaveValue("");
  await expect(chips.getByRole("button")).toHaveText(["Burnhamthorpe Community Centre ✕"]);

  // A second centre, by keyboard.
  await centre.pressSequentially("meadowvale c");
  await centre.press("Enter");
  await expect(page).toHaveURL(/[?&]centre=119%2C290\b|[?&]centre=290%2C119\b/);
  await expect(chips.getByRole("button")).toHaveCount(2);
  // The Filters badge counts each centre.
  if (phone) await expect(page.getByRole("button", { name: "Filters (2 on)" })).toHaveCount(1);
  await centre.press("ArrowDown");
  await expect(list.getByRole("option", { name: "Meadowvale Community Centre" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // A tap outside with the list open closes only the list.
  await page.mouse.click(phone ? 180 : 1200, phone ? 60 : 80);
  await expect(list).toBeHidden();
  await expect(sheet).toBeVisible();

  // Escape closes the list, not the sheet.
  await centre.click();
  await expect(list).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await expect(sheet).toBeVisible();

  // Removing a chip drops that centre.
  await chips.getByRole("button", { name: "Remove Burnhamthorpe Community Centre" }).click();
  await expect(page).toHaveURL(/[?&]centre=119\b/);
  await expect(chips.getByRole("button")).toHaveCount(1);

  // Clear filters empties it.
  await sheet.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).not.toHaveURL(/centre=/);
  await expect(chips).toHaveCount(0);
  await expect(centre).toHaveAttribute("placeholder", "All centres");
});

test("a card's centre name adds that centre to the filter", async ({ page }, testInfo) => {
  await page.goto("/?type=enroll&q=pickle");
  // A tap before hydration can be lost under load (the URL never changed); wait like the popup tests.
  await hydrated(page);
  await page
    .getByRole("article")
    .first()
    .getByRole("link", { name: "Burnhamthorpe Community Centre" })
    .click();
  // Same list, other filters kept, centre added.
  await expect(page).toHaveURL(/^[^?]*\/\?(?=.*type=enroll)(?=.*q=pickle)(?=.*centre=290)/);
  if (isPhone(testInfo.project.name)) await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByRole("list", { name: "Chosen centres" }).getByRole("button")).toHaveText([
    "Burnhamthorpe Community Centre ✕",
  ]);
});

test("a quick tick and untick in the picker doesn't hide a card's centre link later", async ({
  page,
}, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await page.goto("/?type=enroll");
  await hydrated(page); // the picker only opens once the page is interactive
  if (phone) await page.getByRole("button", { name: /^Filters/ }).click();
  const sheet = page.getByRole("region", { name: "Filters" });
  await sheet.getByRole("combobox", { name: "Community centre" }).click();
  const option = sheet.getByRole("option", { name: "Burnhamthorpe Community Centre" });
  await option.click();
  await option.click(); // untick before the URL has caught up
  await page.keyboard.press("Escape"); // closes the list
  await expect(page).not.toHaveURL(/centre=/);
  if (phone) await page.keyboard.press("Escape"); // closes the sheet

  await page
    .getByRole("article")
    .first()
    .getByRole("link", { name: "Burnhamthorpe Community Centre" })
    .click();
  await expect(page).toHaveURL(/centre=290/);
  if (phone) await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(page.getByRole("list", { name: "Chosen centres" }).getByRole("button")).toHaveText([
    "Burnhamthorpe Community Centre ✕",
  ]);
});

test(
  "there is no week view or nav tabs; centre pages go by name, not id",
  ANY_SIZE,
  async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
    // /calendar and /centres: see the activity slug test.
    expect((await page.goto("/centres/290"))?.status()).toBe(404);
  },
);

test("the footer links to GitHub issues in a new tab", ANY_SIZE, async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("contentinfo").getByRole("link", { name: /Report a problem/ });
  await expect(link).toHaveAttribute(
    "href",
    "https://github.com/shivam183/mississauga-drop-in/issues/new/choose",
  );
  await expect(link).toHaveAttribute("target", "_blank");
});

test("the GitHub icon links to the repo in a new tab", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("banner").getByRole("link", { name: /Source code on GitHub/ });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "https://github.com/shivam183/mississauga-drop-in");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("title", "Source code on GitHub");
  // Level with the site name.
  const header = (await page.getByRole("link", { name: "Mississauga Drop-In" }).boundingBox())!;
  const box = (await link.boundingBox())!;
  expect(Math.abs(box.y + box.height / 2 - (header.y + header.height / 2))).toBeLessThan(4);

  // It's the only GitHub link; the footer no longer repeats it.
  await expect(page.getByRole("link", { name: /GitHub/ })).toHaveCount(1);
});

test("the coffee icon sits top right, after the GitHub icon, and opens Buy Me a Coffee", async ({
  page,
}) => {
  await page.goto("/");
  const coffee = page.getByRole("banner").getByRole("link", { name: /buy me a coffee/i });
  await expect(coffee).toHaveAttribute("href", "https://buymeacoffee.com/shivam183");
  await expect(coffee).toHaveAttribute("target", "_blank");
  await expect(coffee).toHaveAttribute("title", "Buy me a coffee");
  const github = page.getByRole("banner").getByRole("link", { name: /Source code on GitHub/ });
  const c = (await coffee.boundingBox())!;
  const g = (await github.boundingBox())!;
  // Top right of the header's content (which is centred on wide screens).
  const content = (await page.locator(".site-header-inner").boundingBox())!;
  expect(c.x + c.width).toBeGreaterThan(content.x + content.width - 40);
  expect(g.x + g.width).toBeLessThanOrEqual(c.x + 1);
  expect(Math.abs(c.y - g.y)).toBeLessThan(2);
});

test("Back to top shows once you scroll into the list and takes you to the top", async ({
  page,
}) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: "Back to top" });
  await expect(button).toBeHidden();
  await page.getByRole("navigation", { name: "Browse" }).scrollIntoViewIfNeeded();
  await button.click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(button).toBeHidden();
  await expect(page.locator("main")).toBeFocused();
});

test("the coffee bubble shows after load and goes at the first scroll", async ({ page }) => {
  await page.goto("/");
  const bubble = page.locator(".coffee-nudge");
  await expect(bubble).toBeVisible();
  await page.mouse.wheel(0, 200);
  await expect(bubble).toBeHidden();
});

test(
  "links to other sites open in a new tab; links within the app don't",
  ANY_SIZE,
  async ({ page }) => {
    await page.goto("/?type=enroll");
    await expect(page.getByRole("link", { name: /Enroll now/ }).first()).toBeVisible();
    const links = await page.locator("a[href]").evaluateAll((anchors) =>
      anchors.map((a) => ({
        external: new URL((a as HTMLAnchorElement).href).host !== location.host,
        target: a.getAttribute("target"),
        rel: a.getAttribute("rel") ?? "",
        text: a.textContent?.trim().slice(0, 40),
      })),
    );
    const external = links.filter((l) => l.external);
    expect(external.length).toBeGreaterThan(3);
    for (const link of external) {
      expect(link.target, `"${link.text}" should open a new tab`).toBe("_blank");
      expect(link.rel).toContain("noopener");
    }
    for (const link of links.filter((l) => !l.external)) {
      expect(link.target, `"${link.text}" should stay in this tab`).toBeNull();
    }
  },
);

test("open enroll cards get a green stripe; full ones are faded", async ({ page }) => {
  const cards = await enrollCards(page);
  const [open, full] = [cards.nth(0), cards.nth(1)];
  await expect(open.getByText(/^\d+ spots? left$/)).toBeVisible();
  await expect(full.getByText("Full", { exact: true })).toBeVisible();

  const look = (card: typeof open) =>
    card.evaluate((el) => {
      const style = getComputedStyle(el);
      const css = (name: string) =>
        getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const rgb = (color: string) => {
        const probe = document.createElement("i");
        probe.style.color = color;
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      };
      return {
        shadow: style.boxShadow,
        background: style.backgroundColor,
        open: rgb(css("--open")),
        surface: rgb(css("--surface")),
        timeColor: getComputedStyle(el.querySelector("time")!).color,
        muted: rgb(css("--muted")),
      };
    });

  const openLook = await look(open);
  expect(openLook.shadow).toContain(openLook.open);
  expect(openLook.shadow).toContain("inset");

  const fullLook = await look(full);
  expect(fullLook.shadow).toBe("none");
  expect(fullLook.background).toBe(fullLook.surface);
  expect(fullLook.timeColor).toBe(fullLook.muted);

  // Drop-in cards stay plain.
  await page.goto("/?type=dropin");
  expect((await look(page.getByRole("article").first())).shadow).toBe("none");
});

test("security headers are set, and the CSP doesn't break the page", ANY_SIZE, async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /Content Security Policy|CSP/i.test(msg.text())) {
      errors.push(msg.text());
    }
  });
  const response = await page.goto("/?type=enroll");
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("connect-src 'self'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("geolocation=()");
  expect(headers["x-powered-by"]).toBeUndefined();

  // The app still works under the policy: it hydrates and loads spots.
  await expect(
    page
      .getByRole("article")
      .first()
      .getByText(/spots? left|^Full$/),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("tapping anywhere on a card opens its details; its own links still work", async ({
  page,
  context,
}) => {
  // Don't load the City's real pages in the new tabs.
  await context.route("https://*.activecommunities.com/**", (route) =>
    route.fulfill({ body: "City page" }),
  );
  await page.goto("/?type=enroll");
  await hydrated(page);
  const card = page.getByRole("article").first();
  await expect(card.getByRole("link", { name: /Enroll now/ })).toBeVisible();

  // Tapping a plain part of the card (beside the time) opens the details popup, in this tab.
  const box = (await card.locator("time").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/\/activity\/\d+\?session=e\d+-\d{12}$/);
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Enroll now opens the enroll page in a new tab, not the details.
  const [enroll] = await Promise.all([
    context.waitForEvent("page"),
    card.getByRole("link", { name: /Enroll now/ }).click(),
  ]);
  expect(enroll.url()).toContain("/enroll/");
  await enroll.close();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // The centre name still does its own thing (filters, in this tab).
  await card.getByRole("link", { name: /Community Centre/ }).click();
  await expect(page).toHaveURL(/centre=\d+/);
  expect(context.pages()).toHaveLength(1);
});

/** Waits for hydration (Share buttons appear only then), so taps are handled by the app. */
async function hydrated(page: Page) {
  await expect(page.getByRole("button", { name: /^Share / }).first()).toBeVisible();
}

test.describe("details popup", () => {
  async function openFirst(page: Page, url = "/") {
    await page.goto(url);
    await hydrated(page);
    const title = page.getByRole("article").first().getByRole("heading").getByRole("link");
    const name = (await title.textContent())!.trim();
    await title.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("About", { exact: true })).toBeVisible();
    return { dialog, name, title };
  }

  test("shows what the program is and where, with directions", async ({ page }) => {
    const { dialog } = await openFirst(page);
    await expect(dialog).toHaveAccessibleName(/\S/);
    await expect(dialog.getByText(/Ages \d+/)).toBeVisible();
    await expect(dialog.getByText("Good to know", { exact: true })).toBeVisible();
    // No separate Where section: the centre is in the card, with Directions and Call beside it.
    await expect(dialog.getByRole("heading", { name: "Where" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: /^Directions to / })).toBeVisible();
    await expect(dialog.getByRole("link", { name: /^Call / })).toHaveAttribute("href", /^tel:/);
    await expect(dialog.getByRole("link", { name: /View on ActiveMississauga/ })).toBeVisible();
    // The list behind doesn't scroll while it's open.
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
      "hidden",
    );
  });

  test("Esc, the close button (desktop) and Back each close it and keep the list's place", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await hydrated(page);
    await page.evaluate(() => window.scrollTo(0, 300));
    // Phones have no ✕ in the popup: the handle, a swipe, a tap outside or Back close it.
    const closers = isPhone(testInfo.project.name)
      ? (["Escape", "back"] as const)
      : (["Escape", "button", "back"] as const);
    for (const close of closers) {
      await page.getByRole("article").nth(2).getByRole("heading").getByRole("link").click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("About", { exact: true })).toBeVisible();
      if (close === "Escape") await page.keyboard.press("Escape");
      else if (close === "button") await dialog.getByRole("button", { name: "Close" }).click();
      else await page.goBack();
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(/\/$/);
      expect(await page.evaluate(() => Math.round(window.scrollY)), close).toBe(300);
    }
  });

  test("opens at once with what the card already shows, before the details arrive", async ({
    page,
  }) => {
    await page.goto("/");
    await hydrated(page);
    const card = page.getByRole("article").first();
    const title = card.getByRole("heading").getByRole("link");
    const name = (await title.textContent())!.trim();
    // Hold the server's answer back until released.
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/activity/**", async (route) => {
      await held;
      await route.continue();
    });
    await title.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name })).toBeVisible();
    await expect(dialog.getByText(/^(Today|Tomorrow|\w{3} \w{3} \d+) · /)).toBeVisible();
    await expect(dialog.getByText("About", { exact: true })).toHaveCount(0);
    release();
    await expect(dialog.getByText("About", { exact: true })).toBeVisible();
  });

  test("Directions offers each maps app and lists the last one used first", async ({
    page,
    context,
  }) => {
    const { dialog } = await openFirst(page);
    const directions = dialog.getByRole("button", { name: /^Directions to / });
    const apps = dialog.locator("[popover]").getByRole("link");
    await directions.click();
    // A dropdown under the button, not a card in the middle of the screen.
    const button = (await directions.boundingBox())!;
    const card = (await dialog.locator("[popover]").boundingBox())!;
    expect(card.y).toBeGreaterThan(button.y + button.height);
    expect(card.y).toBeLessThan(button.y + button.height + 20);
    expect(Math.abs(card.x + card.width - (button.x + button.width))).toBeLessThan(2);
    await expect(apps).toHaveText(
      ["Google Maps", "Apple Maps", "Waze"].map((a) => `${a} (opens in a new tab)`),
    );
    // By name and address (Waze by coordinates), so each app finds the centre itself.
    const place = /Centre%2C%20\d+%20[^&]*Mississauga/;
    await expect(apps.nth(0)).toHaveAttribute(
      "href",
      /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/,
    );
    await expect(apps.nth(0)).toHaveAttribute("href", place);
    await expect(apps.nth(1)).toHaveAttribute("href", /^https:\/\/maps\.apple\.com\/\?daddr=/);
    await expect(apps.nth(1)).toHaveAttribute("href", place);
    await expect(apps.nth(2)).toHaveAttribute(
      "href",
      /^https:\/\/waze\.com\/ul\?ll=-?[\d.]+,-?[\d.]+&navigate=yes$/,
    );

    // Picking one closes the card (the app opens in a new tab) and remembers it.
    await context.route(/waze\.com/, (route) => route.fulfill({ body: "waze" }));
    const opened = context.waitForEvent("page");
    await apps.nth(2).click();
    await (await opened).close();
    await expect(apps.first()).toBeHidden();
    await expect(dialog).toBeVisible();

    await directions.click();
    await expect(apps.first()).toHaveText(/^WazeLast used/);
    // Esc closes just the card, not the popup.
    await page.keyboard.press("Escape");
    await expect(apps.first()).toBeHidden();
    await expect(dialog).toBeVisible();
  });

  test("on phones, pulling the handle down closes it, and there's no ✕", async ({
    page,
  }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "phone only");
    await openFirst(page);
    await expect(page.getByRole("dialog").getByRole("button", { name: "Close" })).toBeHidden();
    const handle = page.getByRole("dialog").locator("[class*=grab]");
    const box = (await handle.boundingBox())!;
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(x, box.y + 60, { steps: 4 });
    await page.mouse.move(x, box.y + 160, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  });

  test("on phones, the whole head row pulls down too; a tap there doesn't close", async ({
    page,
  }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "phone only");
    const { dialog } = await openFirst(page);
    // The Drop-in / Enroll badge, below the handle: where a thumb grabs the sheet.
    const badge = dialog.getByText(/^(Drop-in|Enroll online)$/).first();
    const box = (await badge.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await badge.click();
    await expect(dialog).toBeVisible();

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 60, { steps: 4 });
    await page.mouse.move(x, y + 160, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  });

  test("on phones, swiping down on the content at its top closes it; scrolled, it scrolls", async ({
    page,
  }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "phone only");
    const { dialog } = await openFirst(page);
    const body = dialog.locator("[class*=body]").first();
    const box = (await body.boundingBox())!;
    const swipe = (dy: number) => touchSwipe(page, box.x + box.width / 2, box.y + 40, dy);

    // Scrolled down, a swipe down scrolls back up instead (when the content is long enough).
    if (await body.evaluate((b) => b.scrollHeight > b.clientHeight + 50)) {
      await body.evaluate((b) => (b.scrollTop = 50));
      await swipe(150);
      await expect(dialog).toBeVisible();
      await body.evaluate((b) => (b.scrollTop = 0));
    }

    await swipe(150);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  });

  test("Share in the popup copies a link to these details", async ({ page, context }) => {
    // No share sheet, and a clipboard we can read back (as in the card's Share test).
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "share", { value: undefined });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async (t: string) => ((window as { copied?: string }).copied = t) },
      });
    });
    const { dialog } = await openFirst(page);
    const heading = dialog.getByRole("heading", { level: 2 }).first();
    await expect(dialog.getByRole("button", { name: /^Share / })).toHaveAttribute("title", "Share");
    await dialog.getByRole("button", { name: /^Share / }).click();
    await expect(dialog.getByRole("status")).toHaveText("Copied");
    const copied = (await page.evaluate(() => (window as { copied?: string }).copied))!;
    const [first, , , url] = copied.split("\n");
    // The accessible name leaves out the activity icon (aria-hidden), as the shared text does.
    await expect(heading).toHaveAccessibleName(first);
    expect(url).toMatch(/\/activity\/\d+\?session=[de]\d+-\d{12}$/);
    // Whoever opens it gets the full details page.
    const shared = await context.newPage();
    await shared.goto(url);
    await expect(shared.getByRole("heading", { level: 1 })).toHaveAccessibleName(first);
  });

  test("an enroll session shows spots and Enroll without scrolling", async ({ page }) => {
    const { dialog } = await openFirst(page, "/?type=enroll");
    await expect(dialog.getByText(/^\d+ spots? left$/)).toBeVisible();
    const enroll = dialog.getByRole("link", { name: /Enroll now/ });
    await expect(enroll).toBeInViewport();
    await expect(enroll).toHaveAttribute("target", "_blank");
  });

  test("from the keyboard: Enter opens it, focus moves in, and returns on close", async ({
    page,
  }) => {
    await page.goto("/");
    await hydrated(page);
    const title = page.getByRole("article").first().getByRole("heading").getByRole("link");
    await title.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("About", { exact: true })).toBeVisible();
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(title).toBeFocused();
  });

  test("a refresh keeps the list, with the popup open over it where it was", async ({ page }) => {
    await page.goto("/?type=enroll");
    await hydrated(page);
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.getByRole("article").nth(1).getByRole("heading").getByRole("link").click();
    await expect(page.getByRole("dialog").getByText("About", { exact: true })).toBeVisible();
    const url = page.url();

    await page.reload();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("About", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(url);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/\?type=enroll$/);
    await expect(page.getByRole("article").first()).toBeVisible();
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(200);
  });

  test("a shared link (a new tab) is a full page that isn't indexed, with ✕ back to the list", async ({
    page,
    context,
  }) => {
    await openFirst(page);
    const shared = await context.newPage(); // its own sessionStorage, like another device
    await shared.goto(page.url());
    await page.close();
    page = shared;
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/\S/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/\S/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("link", { name: /More at / })).toHaveAttribute(
      "href",
      /^\/centres\/[a-z-]+$/,
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole("link", { name: "Close, show all sessions" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("article").first()).toBeVisible();
  });

  test("an unknown or ended activity shows the not-found page, not indexed", async ({ page }) => {
    for (const url of ["/activity/999999999", "/activity/abc"]) {
      await page.goto(url);
      await expect(page.getByText(/could not be found/i)).toBeVisible();
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
        "content",
        /noindex/,
      );
    }
  });
});

test.describe("collapsible days", () => {
  const day = (page: Page, n: number) => page.locator("details").nth(n);
  /** Opens the page and waits for hydration (Share buttons appear only then). */
  async function open(page: Page) {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /^Share / }).first()).toBeVisible();
    // The headings themselves must be hydrated: a tap before then collapses the
    // day natively, without holding the page height, and the page jumps.
    await expect
      .poll(() =>
        page
          .locator("details summary")
          .first()
          .evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactProps"))),
      )
      .toBe(true);
  }

  test("collapsing a day keeps its heading and refills the page; opening brings it back", async ({
    page,
  }) => {
    await open(page);
    const cards = page.getByRole("article");
    await expect(cards).toHaveCount(30);
    const first = day(page, 0);
    const heading = first.getByRole("heading", { level: 2 });
    const firstCards = await first.getByRole("article").count();
    const days = await page.locator("details").count();

    await first.locator("summary").click();
    await expect(page).toHaveURL(/[?&]collapsed=\d{4}-\d{2}-\d{2}/);
    await expect(first.getByRole("article")).toHaveCount(0);
    await expect(heading).toBeVisible();
    await expect(first.getByRole("status")).toBeHidden();
    // Collapsed days don't use up the page, so later sessions fill it.
    await expect(cards).toHaveCount(30);
    await expect(page.locator("details")).not.toHaveCount(days);

    await first.locator("summary").click();
    await expect(page).not.toHaveURL(/collapsed=/);
    await expect(first.getByRole("article")).toHaveCount(firstCards);
  });

  test("collapsing a day from its stuck heading keeps it at the top, with no jump", async ({
    page,
  }) => {
    await open(page);
    const first = day(page, 0);
    await first.getByRole("article").nth(8).scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 400);
    const summary = first.locator("summary");
    await expect(summary).toBeInViewport();
    expect(await first.evaluate((d) => d.getBoundingClientRect().top)).toBeLessThan(0);

    await summary.click();
    // Right away, before the refill: no jump to the top of the page, the heading
    // sits just under the sticky site header, and the next day's cards are already there.
    const top = await summary.evaluate((s) => s.getBoundingClientRect().top);
    const header = (await page.getByRole("banner").boundingBox())!;
    expect(Math.abs(top - (header.y + header.height))).toBeLessThanOrEqual(2);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(100);
    await expect(day(page, 1).getByRole("article").first()).toBeInViewport();

    await expect(page).toHaveURL(/collapsed=/);
    await expect(first.getByRole("article")).toHaveCount(0);
    await expect(summary).toBeInViewport();
  });

  test(
    "Show more keeps collapsed days; a new search opens them all",
    ANY_SIZE,
    async ({ page }) => {
      await open(page);
      await day(page, 0).locator("summary").click();
      await expect(page).toHaveURL(/collapsed=/);
      await page.getByRole("link", { name: "Show more" }).click();
      await expect(page).toHaveURL(/limit=60/);
      await expect(page).toHaveURL(/collapsed=/);
      await expect(day(page, 0)).not.toHaveAttribute("open");

      // Typing a search opens them.
      await page.getByRole("searchbox").fill("lane");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/[?&]q=lane(&|$)/);
      await expect(page).not.toHaveURL(/collapsed=/);
      await expect(page.locator("details:not([open])")).toHaveCount(0);

      // So does a chip.
      await day(page, 0).locator("summary").click();
      await expect(page).toHaveURL(/collapsed=/);
      const chips = page.getByRole("navigation", { name: "Activity" });
      await chips.getByRole("link", { name: "Swim" }).click();
      await expect(page).toHaveURL(/[?&]q=swim\b/);
      await expect(page).not.toHaveURL(/collapsed=/);
      await expect(page.locator("details:not([open])")).toHaveCount(0);
    },
  );

  test("a heading toggles from the keyboard", ANY_SIZE, async ({ page }) => {
    await open(page);
    const summary = day(page, 0).locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(day(page, 0)).not.toHaveAttribute("open");
    await expect(page).toHaveURL(/collapsed=/);
    await page.keyboard.press("Enter");
    await expect(day(page, 0)).toHaveAttribute("open");
  });
});

// The mock's recorded "swim" search: #0 open with 12 spots, #1 full, #2 opening tomorrow (see mock-activenet.mjs).
test.describe("registered programs", () => {
  test("the header toggle switches between Drop-in and Registered", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("navigation", { name: "Area" });
    await expect(toggle.getByRole("link", { name: "Drop-in" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await toggle.getByRole("link", { name: "Registered" }).click();
    await expect(page).toHaveURL(/\/registered$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Registered programs in Mississauga",
    );
    await expect(toggle.getByRole("link", { name: "Registered" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await toggle.getByRole("link", { name: "Drop-in" }).click();
    await expect(page).toHaveURL(/:\d+\/$/);
    await expect(toggle.getByRole("link", { name: "Drop-in" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("on phones the header stays one row", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "phone only");
    await page.goto("/registered");
    const toggle = (await page.getByRole("navigation", { name: "Area" }).boundingBox())!;
    const coffee = (await page.getByRole("link", { name: /Buy me a coffee/ }).boundingBox())!;
    expect(Math.abs(toggle.y + toggle.height / 2 - (coffee.y + coffee.height / 2))).toBeLessThan(4);
  });

  test("cards are compact: time with dates, spots and Share, no price, Enroll at the bottom", async ({
    page,
  }) => {
    await page.goto("/registered");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/registered$/);
    const cards = page.getByRole("article");
    const open = cards.nth(0);
    await expect(open.getByText("Sat 8:30 – 9:00 AM", { exact: true })).toBeVisible();
    await expect(open.getByText("Sep 26 – Dec 12", { exact: true })).toBeVisible();
    await expect(open.getByText(/\$\d/)).toHaveCount(0); // the price varies, so it is only in the popup
    await expect(open.getByRole("button", { name: /^Share / })).toBeVisible();
    await expect(open.getByText("12 spots left")).toBeVisible();
    const enroll = open.getByRole("link", { name: /Enroll now/ });
    await expect(enroll).toHaveAttribute("href", /\/activity\/search\/enroll\/158821\b/);
    // Full width, at the bottom of the card.
    const [card, button] = [(await open.boundingBox())!, (await enroll.boundingBox())!];
    expect(card.y + card.height - (button.y + button.height)).toBeLessThan(24);
    expect(button.width).toBeGreaterThan(card.width - 48);
    await expect(cards.nth(1).getByText("Full", { exact: true })).toBeVisible();
    await expect(cards.nth(1).getByRole("link", { name: /Enroll/ })).toHaveCount(0);
    await expect(cards.nth(2).getByText(/^Enrollment opens /)).toBeVisible();
    await expect(cards.nth(2).getByText(/\d+ spots? left/)).toBeVisible();
  });

  test("a search stays on /registered", ANY_SIZE, async ({ page }) => {
    await page.goto("/registered");
    await page.waitForLoadState("networkidle");
    await page.getByRole("searchbox").fill("private");
    await page.getByRole("searchbox").press("Enter");
    await expect(page).toHaveURL(/\/registered\?q=private$/);
    const cards = page.getByRole("article");
    await expect(cards).toHaveCount(3);
    for (const label of await cards.evaluateAll((els) => els.map((e) => e.ariaLabel ?? ""))) {
      expect(label).toBe("Private Lessons Swimming");
    }
  });

  test("a chip picks a category that later filters keep, and is one choice at a time", async ({
    page,
  }, testInfo) => {
    await page.goto("/registered");
    const chips = page.getByRole("navigation", { name: "Program type" });
    await chips.getByRole("link", { name: "Arts" }).click();
    await expect(page).toHaveURL(/\/registered\?cat=47$/);
    await expect(chips.getByRole("link", { name: "Arts" })).toHaveAttribute("aria-current", "page");
    // No Category menu (chips and search cover it); the form carries the chip's category.
    if (isPhone(testInfo.project.name))
      await page.getByRole("button", { name: /^Filters/ }).click();
    const filters = page.getByRole("region", { name: "Filters" });
    await expect(filters.getByLabel("Category")).toHaveCount(0);
    await filters.getByLabel("Has open spots").check();
    await expect(page).toHaveURL(/[?&]cat=47\b/);
    await expect(page).toHaveURL(/[?&]open=1\b/);
    // Clear filters keeps the chip, like the drop-in page.
    await filters.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/registered\?cat=47$/);
    await expect(chips.getByRole("link", { name: "Arts" })).toHaveAttribute("aria-current", "page");
    // Camps is a keyword; picking it drops the Arts category.
    await page.goto("/registered?cat=47");
    await chips.getByRole("link", { name: "Camps" }).click();
    await expect(page).toHaveURL(/\/registered\?q=camp$/);
  });

  test("the age stepper searches once taps pause, and typing works too", async ({
    page,
  }, testInfo) => {
    await page.goto("/registered");
    if (isPhone(testInfo.project.name))
      await page.getByRole("button", { name: /^Filters/ }).click();
    const filters = page.getByRole("region", { name: "Filters" });
    const age = filters.getByRole("spinbutton", { name: "Age" });
    // A person's taps are 100 ms+ apart; the stepper ignores clicks closer than 60 ms (a duplicated tap).
    const tapOlder = async (times: number) => {
      for (let i = 0; i < times; i++) {
        if (i > 0) await page.waitForTimeout(100);
        await filters.getByRole("button", { name: "Older" }).click();
      }
    };
    await tapOlder(3);
    await expect(page).toHaveURL(/\/registered\?age=3$/);
    await expect(age).toHaveValue("3");
    await filters.getByRole("button", { name: "Younger" }).click();
    await expect(page).toHaveURL(/\/registered\?age=2$/);
    await age.fill("12");
    await expect(page).toHaveURL(/\/registered\?age=12$/);
    // No one is 0: typing it, or − from 1, goes back to all ages.
    await age.fill("0");
    await expect(page).toHaveURL(/\/registered$/);
    await expect(age).toHaveValue("");
    await expect(age).toHaveAttribute("placeholder", "All ages");
    await filters.getByRole("button", { name: "Older" }).click();
    await expect(page).toHaveURL(/\/registered\?age=1$/);
    await filters.getByRole("button", { name: "Younger" }).click();
    await expect(page).toHaveURL(/\/registered$/);
    await expect(age).toHaveValue("");
    // The pill's ✕ clears the field, even back to a URL the form itself went to before.
    await tapOlder(3);
    await expect(page).toHaveURL(/\/registered\?age=3$/);
    if (isPhone(testInfo.project.name)) await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Remove Age 3" }).click();
    await expect(page).toHaveURL(/\/registered$/);
    if (isPhone(testInfo.project.name))
      await page.getByRole("button", { name: /^Filters/ }).click();
    await expect(age).toHaveValue("");
  });

  test("several days, upcoming or all seasons, and pills that remove a filter", async ({
    page,
  }, testInfo) => {
    await page.goto("/registered");
    const phone = isPhone(testInfo.project.name);
    if (phone) await page.getByRole("button", { name: /^Filters/ }).click();
    const filters = page.getByRole("region", { name: "Filters" });
    await expect(filters.getByLabel("Season")).toHaveValue("");
    await expect(filters.getByLabel("Season").locator("option").nth(0)).toHaveText(
      "Upcoming seasons",
    );
    await filters.getByRole("checkbox", { name: "Tuesday" }).check();
    await expect(page).toHaveURL(/[?&]day=tue\b/);
    await filters.getByRole("checkbox", { name: "Thursday" }).check();
    await expect(page).toHaveURL(/[?&]day=tue&day=thu$/);
    await filters.getByLabel("Season").selectOption("all");
    await expect(page).toHaveURL(/[?&]season=all\b/);
    if (phone) await page.keyboard.press("Escape");

    const pills = page.getByRole("list", { name: "Filters in use" });
    await expect(pills.getByRole("link")).toHaveText(["All seasons✕", "Tuesday✕", "Thursday✕"]);
    await pills.getByRole("link", { name: "Remove Tuesday" }).click();
    await expect(page).toHaveURL(/\/registered\?season=all&day=thu$/);
    // The form follows: Tuesday is unticked, Thursday still ticked.
    if (phone) await page.getByRole("button", { name: /^Filters/ }).click();
    await expect(filters.getByRole("checkbox", { name: "Tuesday" })).not.toBeChecked();
    await expect(filters.getByRole("checkbox", { name: "Thursday" })).toBeChecked();
  });

  test("a card opens its details: when, fees and Enroll; Esc closes it", async ({ page }) => {
    await page.goto("/registered");
    await page.waitForLoadState("networkidle");
    await page.getByRole("article").first().getByRole("heading").getByRole("link").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "H3O Swim For Life 1" })).toBeVisible();
    await expect(dialog.getByText("Sat · 8:30 – 9:00 AM", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Sep 26 – Dec 12", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Non-resident")).toBeVisible();
    await expect(dialog.getByText("$298.00")).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Enroll now/ })).toBeVisible();
    await expect(page).toHaveURL(/\/registered\/158821$/);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/registered$/);
  });

  test("a program page loads directly; unknown ids are not found", ANY_SIZE, async ({ page }) => {
    await page.goto("/registered/158821");
    // The accessible name leaves out the activity icon (aria-hidden).
    await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
      "H3O Swim For Life 1",
    );
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    await page.goto("/registered/999999");
    await expect(page.getByText(/could not be found/i)).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  });
});
