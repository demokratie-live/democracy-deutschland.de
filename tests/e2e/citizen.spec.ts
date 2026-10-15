import { expect, test } from "@playwright/test";
import { trackErrors } from "./helpers";

/** Hotspots of default_citizen.tpl / default_politicians.tpl as live renders them. */
const PAGES = [
  {
    path: "/buerger/",
    state: "citizen",
    heading: "DEMOCRACY als Informations- undBeteiligungsplattform für Bürger",
    image: "/files/images/Fur_Burger.png",
    hotspots: [
      ["hotspot hotspot1", "1", "Im Parlament wird ein Gesetzgebungsverfahren initiiert"],
      ["hotspot active hotspot2", "2", "DEMOCRACY informiert Dich über das neue Papier"],
      [
        "hotspot active hotspot4",
        "3",
        "Als virtueller Bundestags-abgeordneter kannst Du noch vor der offiziellen Entscheidung selbst über den Antrag abstimmen",
      ],
      [
        "hotspot hotspot5",
        "4",
        "Sobald die Entscheidung im Bundestag vorliegt, kannst Du Dein und das Abstimmungsverhalten der Community mit dem der Politiker und Fraktionen vergleichen",
      ],
    ],
    buttons: [
      ["Jetzt Pate werden", "/spenden/#donate"],
      ["DEMOCRACY testen", "/"],
      ["Spenden", "/spenden/#donate"],
      ["KONTAKTFORMULAR", "/kontakt/"],
    ],
  },
  {
    path: "/politiker/",
    state: "politicians",
    heading: "DEMOCRACY als Stimmungs-messer für Politiker",
    image: "/files/images/FurPoli.png",
    hotspots: [
      [
        "hotspot hotspot1p",
        "1",
        "Als Politiker erhälst Du vor der offiziellen Entscheidung neben den Fraktionsinformationen ein Stim-mungsbild zu jedem Vorgang aus der gesamtdeutschen Nutzerschaft",
      ],
      [
        "hotspot hotspot2p",
        "2",
        "Das DEMOCRACY Wahlkreisergebnis liefert Dir zusätzlich die Ergebnisse aus Deinem Repräsentationsgebiet; hiermit kannst Du prüfen, wie die Bürger in  Deinem Wahlkreis zu den Vorhaben stehen",
      ],
      [
        "hotspot active hotspot3p",
        "3",
        "Die dauerhafte Rückkopplung hilft Dir als Abgeordneter, Dich besser positionieren zu können und lädt Dich ein, Deine Entscheidungen der Bevölkerung transparent zu erklären und Vertrauen aufzubauen",
      ],
    ],
    buttons: [
      ["AppGeordneter werden", "/kontakt/"],
      ["DEMOCRACY testen", "/"],
      ["Spenden", "/spenden/#donate"],
      ["KONTAKTFORMULAR", "/kontakt/"],
    ],
  },
] as const;

for (const page of PAGES) {
  test.describe(page.path, () => {
    test.beforeEach(async ({ page: tab }) => {
      await tab.goto(page.path);
    });

    test("loads without errors, navbar marks nothing", async ({ page: tab }) => {
      const errors = trackErrors(tab);
      await tab.reload();
      await tab.waitForLoadState("networkidle");
      expect(errors).toEqual([]);
      await expect(tab.locator(".nav-item.active")).toHaveCount(0);
      await expect(tab.locator("nav.navbar")).not.toHaveClass(/startpage/);
      await expect(tab.locator("#content h1").first()).toHaveText(page.heading);
      await expect(tab.locator("#hotspot-img")).toHaveAttribute("src", page.image);
      const broken = await tab.evaluate(() =>
        [...document.images].filter((img) => img.naturalWidth === 0).map((img) => img.src),
      );
      expect(broken).toEqual([]);
    });

    test("hotspots in the state after .tooltip(): title moved to data-original-title", async ({
      page: tab,
    }) => {
      const hotspots = await tab
        .locator(".hotspot-box .hotspot")
        .evaluateAll((elements) =>
          elements.map((element) => [
            element.className,
            element.textContent,
            element.getAttribute("data-original-title"),
            element.getAttribute("title"),
            element.getAttribute("data-toggle"),
            element.getAttribute("data-placement"),
          ]),
        );
      expect(hotspots).toEqual(
        page.hotspots.map(([className, number, title]) => [
          className,
          number,
          title,
          "",
          "tooltip",
          "top",
        ]),
      );
    });

    test("hover shows the Bootstrap tooltip, leaving removes it", async ({ page: tab }) => {
      for (const [className, , title] of page.hotspots) {
        const hotspot = tab.locator(`.${className.split(" ").pop()}`);
        await hotspot.hover();
        const tooltip = tab.locator("body > .tooltip");
        await expect(tooltip).toHaveCount(1);
        await expect(tooltip).toHaveClass(/^tooltip fade bs-tooltip-(top|bottom) show$/);
        await expect(tooltip).toHaveAttribute("role", "tooltip");
        await expect(tooltip.locator(".tooltip-inner")).toHaveText(title.replace(/ {2}/g, " "));
        await expect(tooltip).toHaveCSS("opacity", "0.9");
        const id = await tooltip.getAttribute("id");
        expect(id).toMatch(/^tooltip\d+$/);
        await expect(hotspot).toHaveAttribute("aria-describedby", id!);
        // Popper places the tip above the hotspot, the arrow points at its centre.
        const [tip, spot, arrow] = await Promise.all([
          tooltip.boundingBox(),
          hotspot.boundingBox(),
          tooltip.locator(".arrow").boundingBox(),
        ]);
        expect(tip!.y + tip!.height).toBeLessThanOrEqual(spot!.y + 1);
        expect(Math.abs(arrow!.x + arrow!.width / 2 - (spot!.x + spot!.width / 2))).toBeLessThan(2);

        await tab.mouse.move(5, 5);
        await expect(tooltip).toHaveCount(0);
        await expect(hotspot).not.toHaveAttribute("aria-describedby");
      }
    });

    test("the tooltip fades in and out in 150 ms", async ({ page: tab }) => {
      const hotspot = tab.locator(`.${page.hotspots[0][0].split(" ").pop()}`);
      await hotspot.hover();
      await expect(tab.locator(".tooltip")).toHaveCSS("transition", "opacity 0.15s linear");
      // Right after leaving the tip is still in the DOM, only without "show".
      const leaving = await hotspot.evaluate((element) => {
        element.dispatchEvent(
          new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }),
        );
        const tip = document.querySelector(".tooltip")!;
        return [tip.isConnected, tip.className];
      });
      expect(leaving).toEqual([true, "tooltip fade bs-tooltip-top"]);
      await expect(tab.locator(".tooltip")).toHaveCount(0);
    });

    test("leaving the page while a tooltip is shown removes it", async ({ page: tab }) => {
      await tab.locator(`.${page.hotspots[0][0].split(" ").pop()}`).hover();
      await expect(tab.locator(".tooltip")).toHaveCount(1);
      // A click event without moving the mouse: the hotspot keeps its hover.
      await tab.locator("#menu_about").dispatchEvent("click");
      await expect(tab).toHaveURL(/\/ueber-uns\/$/);
      await expect(tab.locator(".tooltip")).toHaveCount(0);
    });

    test("buttons link to the new paths", async ({ page: tab }) => {
      const buttons = await tab
        .locator("#content a.btn-democracy")
        .evaluateAll((links) => links.map((link) => [link.textContent, link.getAttribute("href")]));
      expect(buttons).toEqual(page.buttons);
    });

    test(`legacy link #!${page.state} forwards`, async ({ page: tab }) => {
      await tab.goto(`/#!${page.state}`);
      await expect(tab).toHaveURL(new RegExp(`${page.path}$`));
      await expect(tab.locator(".hotspot-box")).toBeVisible();
    });
  });
}

test("/buerger/: video link and the hotspot commented out on live", async ({ page }) => {
  await page.goto("/buerger/");
  await expect(
    page.locator('a[href="https://www.youtube.com/watch?v=ouzgAqvJUA8"]'),
  ).toHaveAttribute("target", "_blank");
  await expect(page.locator(".hotspot3")).toHaveCount(0);
});

test("/politiker/: Art 38 I GG links open dejure.org", async ({ page }) => {
  await page.goto("/politiker/");
  const links = page.locator('#content a[href="https://dejure.org/gesetze/GG/38.html"]');
  await expect(links).toHaveText(["Art 38 I GG", "Art 38 I GG"]);
  for (const link of await links.all()) await expect(link).toHaveAttribute("target", "_blank");
});
