import { expect, test, type Page } from "@playwright/test";
import { mailtoUrl } from "../../src/lib/forms";
import { iconClass } from "../../src/lib/roadmap";
import { roadmapSchema } from "../../src/lib/schemas/roadmap";
import { appLinksSchema, formsSchema } from "../../src/lib/schemas/site";
import { contentYaml, trackErrors, waitForScrollEnd } from "./helpers";

const { messages, recipient } = formsSchema.parse(contentYaml("site/forms.yaml"));
const roadmap = roadmapSchema.parse(contentYaml("engineering/roadmap.yaml"));
const { alpha } = appLinksSchema.parse(contentYaml("site/app-links.yaml"));

const NBSP = " ";
const FILES = [
  { name: "screenshot-1.png", mimeType: "image/png", buffer: Buffer.from("test") },
  { name: "log.txt", mimeType: "text/plain", buffer: Buffer.from("test2") },
];

/** Clicks a send button and returns the alert text (dismissed like a user would). */
async function sendExpectingAlert(page: Page, selector: string) {
  const alerts: string[] = [];
  page.once("dialog", async (dialog) => {
    alerts.push(`${dialog.type()}: ${dialog.message()}`);
    await dialog.dismiss();
  });
  await page.click(selector);
  await expect.poll(() => alerts.length).toBe(1);
  expect(alerts[0]).toMatch(/^alert: /);
  return alerts[0].slice("alert: ".length);
}

/** mailto URL as [address, query object]; the browser escapes a few more characters. */
function decodeMailto(url: string) {
  const [address, query] = url.split("?");
  return [address, Object.fromEntries(new URLSearchParams(query))];
}

/** Non-GET requests of the page (there is no upload or mail server). */
function trackWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && !request.url().startsWith("mailto:"))
      writes.push(`${request.method()} ${request.url()}`);
  });
  return writes;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/engineering/");
});

test("loads without errors, navbar marks nothing (like init_engineering)", async ({ page }) => {
  const errors = trackErrors(page);
  await page.reload();
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
  await expect(page.locator(".nav-item.active")).toHaveCount(0);
  await expect(page.locator("nav.navbar")).not.toHaveClass(/startpage/);
  const broken = await page.evaluate(() =>
    [...document.images].filter((img) => img.naturalWidth === 0).map((img) => img.src),
  );
  expect(broken).toEqual([]);
});

test.describe("roadmap", () => {
  test("column heads with their colour class", async ({ page }) => {
    const heads = page.locator("table.table thead th");
    await expect(heads).toHaveCount(4);
    await expect(heads.first()).toHaveText("Release");
    for (const [index, key] of (["beta", "mvp", "dream"] as const).entries()) {
      const column = roadmap.columns[key];
      const head = heads.nth(index + 1);
      await expect(head).toHaveClass("rotate");
      const line = head.locator("div");
      await expect(line).toHaveClass(`rmicon-${column.color}`);
      expect(await line.textContent()).toBe(column.date);
      expect((await head.textContent())!.startsWith(column.text)).toBe(true);
    }
  });

  test("one row per goal: text, issue link and icon_class() per column", async ({ page }) => {
    const rows = await page.locator("table.table tbody tr").evaluateAll((trs) =>
      trs.map((tr) => {
        const [goal, ...cells] = [...tr.querySelectorAll("td")];
        const link = goal.querySelector("a")!;
        return {
          text: goal.textContent,
          bold: goal.querySelector("b")?.textContent ?? null,
          href: link.getAttribute("href"),
          target: link.getAttribute("target"),
          scope: goal.getAttribute("scope"),
          icons: cells.map((cell) => cell.querySelector("i")!.getAttribute("class")),
        };
      }),
    );
    expect(rows).toEqual(
      roadmap.goals.map((goal) => ({
        text: `${goal.sub ? NBSP.repeat(3) : ""}${goal.goal}${NBSP}${goal.issue ? `#${goal.issue}` : ""}`,
        bold: goal.bold ? goal.goal : null,
        href: `https://github.com/demokratie-live/democracy-client/issues/${goal.issue ?? ""}`,
        target: "_blank",
        scope: "row",
        icons: [goal.beta, goal.mvp, goal.dream].map((code) => `fa ${iconClass(code)}`),
      })),
    );
    expect(rows).toHaveLength(68);
  });

  test("checked cells show the blue and grey check icon", async ({ page }) => {
    const blue = page.locator("tbody i.fa-check-square.rmicon-blue").first();
    await expect(blue).toHaveCSS("color", "rgb(68, 148, 211)");
    await expect(blue).toHaveCSS("font-size", "25px");
    const grey = page.locator("tbody i.fa-check-square.rmicon-grey").first();
    await expect(grey).toHaveCSS("color", "rgb(115, 115, 115)");
    expect(
      await blue.evaluate((element) => getComputedStyle(element, "::before").content),
    ).not.toBe("none");
  });
});

test.describe("alpha test", () => {
  test("badges and button link to the invite page in a new tab", async ({ page }) => {
    const links = page.locator(".badges2 a");
    await expect(links).toHaveCount(3);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute("href", alpha);
      await expect(link).toHaveAttribute("target", "_blank");
    }
    await expect(page.locator(".badges2 .btn-democracy")).toHaveText(
      "Hier gehts zur Bewerbungsformular",
    );
    await expect(page.locator(".badges2 span")).toHaveText(["Alpha", "Alpha"]);
  });

  for (const store of ["app-store", "google-play"]) {
    test(`hover toggles the filled ${store} icon (store hover)`, async ({ page }) => {
      const badge = page.locator(`.badge-link2.icon-${store}-outline2`);
      await expect(badge).not.toHaveClass(new RegExp(`icon-${store}-filled2`));
      await badge.hover();
      await expect(badge).toHaveClass(`badge-link2 icon-${store}-outline2 icon-${store}-filled2`);
      await page.mouse.move(5, 5);
      await expect(badge).toHaveClass(`badge-link2 icon-${store}-outline2`);
    });
  }
});

test.describe("anchor #help", () => {
  test("/engineering/#help jumps to the volunteer section", async ({ page }) => {
    await page.goto("/engineering/#help");
    await page.waitForLoadState("networkidle");
    const { scroll, top } = await page.evaluate(() => ({
      scroll: Math.round(window.scrollY),
      top: Math.round(document.getElementById("help")!.getBoundingClientRect().top + scrollY),
    }));
    expect(scroll).toBe(top);
  });

  test("footer “Mithelfen” on the same page scrolls to #help", async ({ page }) => {
    await page.locator(".footer a", { hasText: "Mithelfen" }).click();
    await expect(page).toHaveURL(/\/engineering\/#help$/);
    const scroll = await waitForScrollEnd(page);
    const top = await page.evaluate(() =>
      Math.round(document.getElementById("help")!.getBoundingClientRect().top + scrollY),
    );
    expect(Math.round(scroll)).toBe(top);
  });

  test("footer links from another page: “Programmieren” at the top, “Mithelfen” at #help", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator(".footer a", { hasText: "Programmieren" }).click();
    await expect(page).toHaveURL(/\/engineering\/$/);
    await expect(page.locator("table.table")).toBeVisible();
    expect(await waitForScrollEnd(page)).toBe(0);

    await page.goto("/");
    await page.locator(".footer a", { hasText: "Mithelfen" }).click();
    await expect(page).toHaveURL(/\/engineering\/#help$/);
    const scroll = await waitForScrollEnd(page);
    const top = await page.evaluate(() =>
      Math.round(document.getElementById("help")!.getBoundingClientRect().top + scrollY),
    );
    expect(Math.round(scroll)).toBe(top);
  });

  test("legacy links #!engineering and #!engineering#help forward", async ({ page }) => {
    await page.goto("/#!engineering");
    await expect(page).toHaveURL(/\/engineering\/$/);
    await page.goto("/#!engineering#help");
    await expect(page).toHaveURL(/\/engineering\/#help$/);
  });
});

test.describe("bug report", () => {
  const FIELDS = ["#bug-name", "#bug-email", "#bug-title", "#bug-platform", "#bug-version"];

  async function fill(page: Page, values: string[], text: string) {
    for (const [index, selector] of FIELDS.entries()) await page.fill(selector, values[index]);
    await page.fill("#bug-text", text);
  }

  test("fields, placeholders and button like default_engineering.tpl", async ({ page }) => {
    const fields = await page
      .locator("#bug-form input, #bug-form textarea")
      .evaluateAll((els) =>
        els.map((el) => [
          el.id,
          el.tagName.toLowerCase(),
          el.getAttribute("type"),
          el.getAttribute("placeholder"),
        ]),
      );
    expect(fields).toEqual([
      ["bug-name", "input", "text", "Dein Name*"],
      ["bug-email", "input", "email", "E-Mail-Adresse für Rückfragen*"],
      ["bug-title", "input", "text", "Betreff/Titel"],
      ["bug-platform", "input", "text", "Plattform (iOS/Android)*"],
      ["bug-version", "input", "text", "Version*"],
      [
        "bug-text",
        "textarea",
        null,
        "Bitte beschreibe den Fehler möglichst genau in wenigen Sätzen; beziehe Dich dabei auf Screenshots und markiere die fehlerhaften Bereiche*",
      ],
      ["bug-files", "input", "file", null],
    ]);
    await expect(page.locator("#bug-files")).toBeHidden();
    await expect(page.locator("#bug-files")).toHaveAttribute("multiple", "");
    await expect(page.locator("#bug-file-drop-zone")).toHaveText(
      "Dateien anhängen durch drag & drop oder auswählen.",
    );
    await expect(page.locator("#bug-progress")).toBeHidden();
    await expect(page.locator("#bug-file-list")).toBeHidden();
    await expect(page.locator("#bug-send")).toHaveText("Bericht senden");
  });

  test("checks name, email, title and text in order: alert, then focus", async ({ page }) => {
    const ok = ["Max", "max@example.org", "Absturz", "iOS", "1.5.12"];
    const cases: Array<[string[], string, string, string]> = [
      [["", "", "", "", ""], "", messages.firstName, "#bug-name"],
      [["Ma", ...ok.slice(1)], "Hallo", messages.firstName, "#bug-name"],
      // Live stops here with a ReferenceError (validateEmail is not defined).
      [["Max", "max@example", ...ok.slice(2)], "Hallo", messages.email, "#bug-email"],
      [["Max", "max@example.org", "Ab", "iOS", "1.5.12"], "Hallo", messages.text, "#bug-title"],
      [ok, "Ha", messages.text, "#bug-text"],
      // Platform and version are not checked (like live).
    ];
    for (const [values, text, message, focused] of cases) {
      await fill(page, values, text);
      expect(await sendExpectingAlert(page, "#bug-send")).toBe(message);
      await expect(page.locator(focused)).toBeFocused();
    }
  });

  test("without endpoint the button opens a prefilled mailto and keeps the form", async ({
    page,
  }) => {
    const errors = trackErrors(page);
    let dialogs = 0;
    page.on("dialog", (dialog) => {
      dialogs++;
      void dialog.dismiss();
    });
    const values = ["Max Mustermann", "max@example.org", "App stürzt ab", "", "1.5.12"];
    const text = "Beim Öffnen von „Abstimmen“\nstürzt die App ab. 100% & mehr";
    await fill(page, values, text);
    const request = page.waitForRequest((r) => r.url().startsWith("mailto:"));
    await page.click("#bug-send");
    expect(decodeMailto((await request).url())).toEqual(
      decodeMailto(
        mailtoUrl({
          to: recipient,
          subject: "DEMOCRACY Website: bugreport",
          fields: [
            ["Dein Name", values[0]],
            ["E-Mail-Adresse für Rückfragen", values[1]],
            ["Betreff/Titel", values[2]],
            ["Plattform (iOS/Android)", values[3]],
            ["Version", values[4]],
          ],
          text,
        }),
      ),
    );
    for (const [index, selector] of FIELDS.entries()) {
      await expect(page.locator(selector)).toHaveValue(values[index]);
    }
    await expect(page.locator("#bug-text")).toHaveValue(text);
    expect(dialogs).toBe(0);
    expect(errors).toEqual([]);
  });

  test("“auswählen” opens the file picker; files show up like upload() lists them", async ({
    page,
  }) => {
    const writes = trackWrites(page);
    const chooser = page.waitForEvent("filechooser");
    await page.click("#bug-select-files");
    await (await chooser).setFiles(FILES);
    await expect(page).toHaveURL(/\/engineering\/$/);

    const progress = page.locator("#bug-progress");
    await expect(progress).toBeVisible();
    await expect(progress).toHaveCSS("display", "flex");
    await expect(progress.locator(".progress-bar")).toHaveAttribute("style", "width: 0%;");
    await expect(progress.locator(".progress-bar")).toHaveAttribute("aria-valuenow", "0");

    const list = page.locator("#bug-file-list");
    await expect(list).toHaveCSS("display", "block");
    const entries = list.locator("a");
    await expect(entries).toHaveText(["Successscreenshot-1.png", "Successlog.txt"]);
    for (const entry of await entries.all()) {
      await expect(entry).toHaveClass(/^\d+ list-group-item list-group-item-warning$/);
      await expect(entry).toHaveAttribute("target", "_blank");
      await expect(entry).not.toHaveAttribute("href");
      await expect(entry.locator("span.badge.alert-success.pull-right.hidden")).toBeHidden();
    }
    await expect(entries.first()).toHaveCSS("background-color", "rgb(255, 238, 186)");

    // Another selection adds to the list, like a second upload() call.
    await page.setInputFiles("#bug-files", [FILES[0]]);
    await expect(entries).toHaveCount(3);
    expect(writes).toEqual([]);
  });

  test("drag & drop onto the form adds the files, other items are ignored", async ({ page }) => {
    const writes = trackWrites(page);
    const dragover = await page.evaluate(() => {
      const event = new DragEvent("dragover", { bubbles: true, cancelable: true });
      document.getElementById("bug-text")!.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(dragover).toBe(true);
    const dropped = await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(["a"], "bild.png", { type: "image/png" }));
      transfer.items.add("nur Text", "text/plain");
      transfer.items.add(new File(["b"], "notiz.txt", { type: "text/plain" }));
      const event = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      });
      document.getElementById("bug-name")!.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(dropped).toBe(true);
    await expect(page.locator("#bug-file-list a")).toHaveText([
      "Successbild.png",
      "Successnotiz.txt",
    ]);
    await expect(page.locator("#bug-progress")).toBeVisible();
    await expect(page).toHaveURL(/\/engineering\/$/);
    expect(writes).toEqual([]);
  });

  test("Enter in a field does not submit the form", async ({ page }) => {
    await page.fill("#bug-name", "Max");
    await page.press("#bug-name", "Enter");
    await expect(page).toHaveURL(/\/engineering\/$/);
    await expect(page.locator("#bug-name")).toHaveValue("Max");
  });
});

test.describe("volunteer", () => {
  const ROLES = [
    ["uiux", "UI/UX-Designer"],
    ["frontend", "Front-End-Developer"],
    ["backend", "Back-End-Developer"],
    ["kryptologe", "Kryptograph"],
    ["marketing", "Marketingstratege"],
    ["redakteur", "Redakteur"],
    ["botschafter", "Botschafter"],
  ];

  test("fields, checkboxes and button like default_engineering.tpl", async ({ page }) => {
    const form = page.locator("#vol-form");
    await expect(form.locator("#vol-name")).toHaveAttribute("placeholder", "Dein Name*");
    await expect(form.locator("#vol-email")).toHaveAttribute("type", "email");
    await expect(form.locator("#vol-email")).toHaveAttribute(
      "placeholder",
      "Deine E-Mail-Adresse*",
    );
    await expect(form.locator("#vol-text")).toHaveAttribute(
      "placeholder",
      "Erzähle uns über Deine Erfahrungen/Idee(n)*",
    );
    await expect(form.locator("h5")).toHaveText([
      "Ich möchte DEMOCRACY mitgestalten als",
      "Ich möchte ein App-Feature vorschlagen",
    ]);
    const checkboxes = await form
      .locator('input[type="checkbox"]')
      .evaluateAll((inputs) => inputs.map((input) => [input.id, input.nextSibling?.textContent]));
    expect(checkboxes).toEqual([
      ...ROLES.map(([id, label]) => [`vol-${id}`, `${NBSP}${label}`]),
      ["vol-feature", `${NBSP}Feature-Vorschlag`],
    ]);
    await expect(form.locator("#vol-send")).toHaveText("Als Freiwillige/r melden");
  });

  test("checks name, email and text in order: alert, then focus", async ({ page }) => {
    const cases: Array<[string, string, string, string, string]> = [
      ["", "", "", messages.firstName, "#vol-name"],
      ["Ma", "max@example.org", "Hallo", messages.firstName, "#vol-name"],
      // Live stops here with a ReferenceError (validateEmail is not defined).
      ["Max", "max@", "Hallo", messages.email, "#vol-email"],
      ["Max", "max@example.org", "Ha", messages.text, "#vol-text"],
    ];
    for (const [name, email, text, message, focused] of cases) {
      await page.fill("#vol-name", name);
      await page.fill("#vol-email", email);
      await page.fill("#vol-text", text);
      expect(await sendExpectingAlert(page, "#vol-send")).toBe(message);
      await expect(page.locator(focused)).toBeFocused();
    }
  });

  test("without endpoint: prefilled mailto with the checked roles", async ({ page }) => {
    let dialogs = 0;
    page.on("dialog", (dialog) => {
      dialogs++;
      void dialog.dismiss();
    });
    await page.fill("#vol-name", "Erika Musterfrau");
    await page.fill("#vol-email", "erika@example.org");
    await page.fill("#vol-text", "Ich kann React.");
    await page.check("#vol-frontend");
    await page.check("#vol-redakteur");
    let request = page.waitForRequest((r) => r.url().startsWith("mailto:"));
    await page.click("#vol-send");
    const expected = (roles: string, feature: string) =>
      decodeMailto(
        mailtoUrl({
          to: recipient,
          subject: "DEMOCRACY Website: volunteer",
          fields: [
            ["Dein Name", "Erika Musterfrau"],
            ["Deine E-Mail-Adresse", "erika@example.org"],
            ["Ich möchte DEMOCRACY mitgestalten als", roles],
            ["Ich möchte ein App-Feature vorschlagen", feature],
          ],
          text: "Ich kann React.",
        }),
      );
    expect(decodeMailto((await request).url())).toEqual(
      expected("Front-End-Developer, Redakteur", "–"),
    );
    await expect(page.locator("#vol-frontend")).toBeChecked();

    await page.uncheck("#vol-frontend");
    await page.uncheck("#vol-redakteur");
    await page.check("#vol-feature");
    request = page.waitForRequest((r) => r.url().startsWith("mailto:"));
    await page.click("#vol-send");
    expect(decodeMailto((await request).url())).toEqual(expected("–", "Feature-Vorschlag"));
    expect(dialogs).toBe(0);
  });
});
