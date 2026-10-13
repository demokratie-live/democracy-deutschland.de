import { expect, test } from "@playwright/test";
import type { Team } from "../../src/lib/schemas/team";
import { contentYaml, trackErrors } from "./helpers";

const { members } = contentYaml<Team>("team/team.yaml");

test.beforeEach(async ({ page }) => {
  await page.goto("/ueber-uns/");
});

test("loads without errors, navbar marks Über Uns", async ({ page }) => {
  const errors = trackErrors(page);
  await page.reload();
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
  await expect(page.locator(".nav-item.active")).toHaveText(["Über Uns"]);
  await expect(page.locator(".navbar")).not.toHaveClass(/startpage/);
});

test("texts from MDX", async ({ page }) => {
  await expect(page.locator("#statement-heading")).toHaveText("DEMOCRACY Deutschland e.V.");
  await expect(page.locator("#mission-statement #video-title h1")).toHaveText(
    "Initiativenleitbild / Mission Statement (10:46)",
  );
  await expect(page.locator(".main-container h1")).toHaveText([
    "Mitarbeiter",
    "Unsere Philosophie",
  ]);
  await expect(page.locator(".services-icon strong")).toHaveText([
    "TRANSPARENT",
    "NICHT PROFITORIENTIERT",
    "DATENSPARSAM",
  ]);
  await expect(page.locator("#ri-link-about")).toHaveText("Marius Krüger, Gründer");
  // "Praktikanten & Volunteers" is commented out on live.
  await expect(page.getByText("Praktikanten")).toHaveCount(0);
});

test("team cards come from team.yaml", async ({ page }) => {
  const cards = page.locator(".team_div");
  await expect(cards).toHaveCount(members.length);
  for (const [index, member] of members.entries()) {
    const card = cards.nth(index);
    await expect(card.locator("h4")).toHaveText(member.name);
    await expect(card.locator(".team_text")).toHaveText(member.text.join(""));
    await expect(card.locator(".team_text br")).toHaveCount(member.text.length - 1);
    await expect(card.locator("img")).toHaveAttribute("src", member.img);
    await expect(card.locator("img")).toHaveAttribute("alt", member.name);
    const links = card.locator("a.team_link");
    await expect(links).toHaveCount(member.links.length);
    for (const [i, link] of member.links.entries()) {
      await expect(links.nth(i)).toHaveAttribute("href", link.url);
      await expect(links.nth(i)).toHaveAttribute("target", "_blank");
      await expect(links.nth(i).locator("i")).toHaveAttribute("class", link.icon);
    }
  }
  // Images are complete (no broken hover or team photo).
  const broken = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLImageElement>(".team_div img")]
      .filter((img) => img.naturalWidth === 0)
      .map((img) => img.src),
  );
  expect(broken).toEqual([]);
});

test("hover shows the contact links instead of the text, the photo stays", async ({ page }) => {
  for (const [index, member] of members.entries()) {
    const card = page.locator(".team_div").nth(index);
    await expect(card.locator(".team_links")).toBeHidden();
    await expect(card.locator(".team_text")).toBeVisible();

    await card.hover();
    await expect(card.locator(".team_links")).toBeVisible();
    await expect(card.locator(".team_links")).toHaveCSS("display", "block");
    await expect(card.locator(".team_text")).toBeHidden();
    await expect(card.locator("img")).toHaveAttribute("src", member.imgHover ?? member.img);
    const width = await card.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth);
    expect(width).toBeGreaterThan(0);

    await page.locator("#statement-heading").hover();
    await expect(card.locator(".team_links")).toBeHidden();
    await expect(card.locator(".team_text")).toBeVisible();
    await expect(card.locator("img")).toHaveAttribute("src", member.img);
  }
});

test("accordion opens the clicked row", async ({ page }) => {
  const rows = page.locator(".containerrow-acc");
  await expect(rows).toHaveCount(6);
  await expect(rows.nth(0).locator(".ri-title-heading-acc")).toHaveText([
    "Das unterstützen wir",
    "Das unterstützen wir nicht",
  ]);
  await expect(rows.nth(0).locator(".ri-title-heading-acc u")).toHaveText("nicht");
  await expect(rows.nth(0).locator(".container-text-acc")).toBeVisible();
  await expect(rows.nth(5).locator(".container-text-acc")).toBeHidden();
  // Unlike the Wahl-O-Meter, the first left box has no inline width.
  await expect(rows.nth(0).locator(".ri-subtitle-heading-acc").first()).not.toHaveAttribute(
    "style",
    /width/,
  );

  await rows.nth(5).locator(".ri-subtitle-left").click();
  await expect(rows.nth(5).locator(".container-text-acc")).toHaveCSS("display", "inline-flex");
  await expect(rows.nth(5).locator(".acc-content-left")).toContainText("nach ihrem Gewissen");
  await expect(rows.nth(0).locator(".container-text-acc")).toBeHidden();
  await expect(rows.nth(5).locator(".rectanglebox-acc")).toHaveClass(/content-open/);
  await expect(rows.nth(0).locator(".ri-title-heading-acc")).toHaveCount(0);
  await expect(rows.nth(5).locator(".haken").first()).toBeHidden();
  await expect(rows.nth(0).locator(".haken").first()).toBeVisible();
});

test("YouTube thumbnail starts the mission statement video", async ({ page }) => {
  const container = page.locator("#mission-statement .yt-hd-thumbnail-inner-container");
  await expect(container.locator("img")).toHaveAttribute(
    "src",
    "https://i.ytimg.com/vi/E3KvgGrGQO4/maxresdefault.jpg",
  );
  await container.locator("a.yt-hd-thumbnail").click();
  await expect(container).toHaveClass(/yt-hd-thumbnail-clicked/);
  await expect(container.locator("iframe")).toHaveAttribute(
    "src",
    "https://www.youtube.com/embed/E3KvgGrGQO4?autoplay=1",
  );
});

test("Discord widget and donate link", async ({ page }) => {
  await expect(page.locator('iframe[src^="https://discordapp.com/widget"]')).toHaveAttribute(
    "src",
    "https://discordapp.com/widget?id=372403545086885888&theme=light",
  );
  await page.getByRole("link", { name: "DEMOCRACY Spenden" }).click();
  await expect(page).toHaveURL(/\/spenden\/$/);
  await expect(page.locator(".nav-item.active")).toHaveText(["Spenden"]);
});

test("legacy link #!about forwards here", async ({ page }) => {
  await page.goto("/#!about");
  await expect(page).toHaveURL(/\/ueber-uns\/$/);
  await expect(page.locator(".team_div")).toHaveCount(members.length);
});
