import { test } from "@playwright/test";
import { expectClientForwarding } from "../legacy-url-check";
import { legacyUrls } from "../legacy-urls";

// Old URLs on a host without .htaccess (`serve out`): LegacyRedirectScript on
// the pages and on the 404 page, BlogQueryScript on /blog/. The server side of
// the same table: `pnpm check-htaccess`.
for (const entry of legacyUrls()) {
  if (entry.client === false) continue;
  test(`${entry.group}: ${entry.from}`, async ({ page, request }) => {
    await expectClientForwarding(page, request, entry);
  });
}
