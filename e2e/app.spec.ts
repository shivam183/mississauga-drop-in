import { expect, test, type Page } from "@playwright/test";

const isPhone = (projectName: string) => projectName === "phone";

/** The first "enrol online" card on /?type=enrol is the mock's open session; the second is full. */
async function enrolCards(page: Page) {
  await page.goto("/?type=enrol");
  return page.getByRole("article");
}

test("the page never scrolls sideways", async ({ page }) => {
  for (const url of ["/", "/?type=enrol", "/centres", "/centres/290"]) {
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

test("type chips filter the list and live in the URL", async ({ page }) => {
  await page.goto("/");
  const chips = page.getByRole("navigation", { name: "Program type" });
  await chips.getByRole("link", { name: "Enrol online" }).click();
  await expect(page).toHaveURL(/[?&]type=enrol\b/);
  await expect(chips.getByRole("link", { name: "Enrol online" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("article").first().getByText("Enrol online")).toBeVisible();
  await expect(page.getByRole("article").getByText("Drop-in", { exact: true })).toHaveCount(0);
});

test("searching starts as soon as typing pauses, with no Search button", async ({ page }) => {
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
});

test("Enter searches straight away", async ({ page }) => {
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

test("an open session shows spots left, when they were checked, and Enrol now", async ({
  page,
}) => {
  const cards = await enrolCards(page);
  const first = cards.first();
  await expect(first.getByText(/^\d+ spots? left$/)).toBeVisible();
  await expect(first.getByText(/as of \d{1,2}:\d{2} [ap]m/)).toBeVisible();
  const enrol = first.getByRole("link", { name: /Enrol now/ });
  await expect(enrol).toHaveAttribute(
    "href",
    /^https:\/\/[^/]+\.activecommunities\.com\/.+\/enroll\/\d+/,
  );
  // Opens the City's page in a new tab, so this list stays open.
  await expect(enrol).toHaveAttribute("target", "_blank");
  await expect(enrol).toHaveAttribute("rel", /noopener/);
  await expect(enrol).toHaveAccessibleName(/opens in a new tab/);
});

test("a full session says Full and has no Enrol button", async ({ page }) => {
  const second = (await enrolCards(page)).nth(1);
  await expect(second.getByText("Full", { exact: true })).toBeVisible();
  await expect(second.getByRole("link", { name: /Enrol now/ })).toHaveCount(0);
  await expect(second.getByRole("link", { name: "See it on ActiveMississauga" })).toBeVisible();
});

test("the refresh button fetches a new count", async ({ page }) => {
  const first = (await enrolCards(page)).first();
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

test("centre picker: type to filter the list, pick one or more centres", async ({
  page,
}, testInfo) => {
  await page.goto("/");
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

test("centre pages list that centre's sessions", async ({ page }) => {
  await page.goto("/centres");
  await page.getByRole("link", { name: /Burnhamthorpe Community Centre/ }).click();
  await expect(page).toHaveURL(/\/centres\/290$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Burnhamthorpe Community Centre" }),
  ).toBeVisible();
  await expect(page.getByRole("article").first()).toBeVisible();
});

test("a card's centre name opens that centre's page", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("article")
    .first()
    .getByRole("link", { name: /Community Centre/ })
    .click();
  await expect(page).toHaveURL(/\/centres\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Community Centre");
});

test("there is no week view or nav tabs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  const response = await page.goto("/calendar");
  expect(response?.status()).toBe(404);
});

test("the GitHub icon links to the repo in a new tab", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("banner").getByRole("link", { name: /Source code on GitHub/ });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "https://github.com/shivam183/mississauga-drop-in");
  await expect(link).toHaveAttribute("target", "_blank");
  // Top right of the header's content (which is centred on wide screens).
  const header = (await page.getByRole("link", { name: "Mississauga Drop-In" }).boundingBox())!;
  const box = (await link.boundingBox())!;
  const content = (await page.locator(".site-header-inner").boundingBox())!;
  expect(box.x + box.width).toBeGreaterThan(content.x + content.width - 40);
  expect(Math.abs(box.y + box.height / 2 - (header.y + header.height / 2))).toBeLessThan(4);

  // It's the only GitHub link; the footer no longer repeats it.
  await expect(page.getByRole("link", { name: /GitHub/ })).toHaveCount(1);
});

test("links to other sites open in a new tab; links within the app don't", async ({ page }) => {
  await page.goto("/?type=enrol");
  await expect(page.getByRole("link", { name: /Enrol now/ }).first()).toBeVisible();
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
});

test("open enrol cards get a green stripe; full ones are faded", async ({ page }) => {
  const cards = await enrolCards(page);
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

test("security headers are set, and the CSP doesn't break the page", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /Content Security Policy|CSP/i.test(msg.text())) {
      errors.push(msg.text());
    }
  });
  const response = await page.goto("/?type=enrol");
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
