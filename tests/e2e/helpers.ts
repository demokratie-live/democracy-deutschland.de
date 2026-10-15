import fs from "fs";
import path from "path";
import type { Page } from "@playwright/test";
import yaml from "yaml";

/** Parsed YAML from content/, the source of truth for expected values. */
export function contentYaml<T = Record<string, unknown>>(file: string): T {
  return yaml.parse(fs.readFileSync(path.join(process.cwd(), "content", file), "utf-8")) as T;
}

/**
 * Collects console errors and uncaught exceptions of our own origin.
 * Third-party frames (YouTube embed, jsdelivr) are ignored.
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
