import fs from "fs";
import path from "path";
import { expect, type Locator, type Page } from "@playwright/test";
import yaml from "yaml";

/** Parsed YAML from content/, the source of truth for expected values. */
export function contentYaml<T = Record<string, unknown>>(file: string): T {
  return yaml.parse(fs.readFileSync(path.join(process.cwd(), "content", file), "utf-8")) as T;
}

/**
 * Collects console errors and uncaught exceptions of our own origin.
 * Third-party frames (YouTube, Discord after a click) are ignored.
 */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const url = message.location().url;
    if (url && !url.startsWith("http://localhost")) return;
    errors.push(`${message.text()} (${url})`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/**
 * Scroll position after a jQuery-style animation has finished: waits until
 * scrollY stays unchanged for 15 animation frames.
 */
export async function waitForScrollEnd(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let last = window.scrollY;
        let stable = 0;
        const check = () => {
          if (window.scrollY === last) {
            if (++stable >= 15) return resolve(window.scrollY);
          } else {
            stable = 0;
            last = window.scrollY;
          }
          requestAnimationFrame(check);
        };
        setTimeout(() => requestAnimationFrame(check), 50);
      }),
  );
}

/**
 * A YouTube thumbnail (YouTubeHDThumbnail) shows the local image and no
 * iframe; a click renders the youtube-nocookie.com player with autoplay.
 * The player request is answered locally, the test needs no network.
 */
export async function expectVideoStartsOnClick(page: Page, container: Locator, videoId: string) {
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>player</title>" }),
  );
  await expect(container.locator("img")).toHaveAttribute("src", `/files/youtube/${videoId}.jpg`);
  expect(await container.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(
    1280,
  );
  await expect(container.locator("iframe")).toHaveCount(0);
  const request = page.waitForRequest((r) =>
    r.url().startsWith("https://www.youtube-nocookie.com/"),
  );
  await container.locator("a.yt-hd-thumbnail").click();
  await expect(container).toHaveClass(/yt-hd-thumbnail-clicked/);
  await expect(container.locator("iframe")).toHaveAttribute(
    "src",
    `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`,
  );
  await expect(container.locator("iframe")).toBeVisible();
  await request;
}
