import { test } from "@playwright/test";
import { expectClientForwarding } from "../legacy-url-check";
import { legacyUrls } from "../legacy-urls";

// tests/legacy-urls.ts below the basePath (GitHub Pages project URL).
const BASE = "/democracy-deutschland.de";

for (const entry of legacyUrls()) {
  if (entry.client === false) continue;
  test(`${entry.group}: ${entry.from}`, async ({ page, request }) => {
    await expectClientForwarding(page, request, entry, BASE);
  });
}
