import { defineConfig, devices } from "@playwright/test";

/**
 * Checks the export built with NEXT_PUBLIC_BASE_PATH=/democracy-deutschland.de
 * (GitHub Pages project URL). Run with `pnpm test:basepath`.
 */
const PORT = 3101;
export const BASE_PATH = "/democracy-deutschland.de";

export default defineConfig({
  testDir: "./tests/basepath",
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    command: `node scripts/serve-basepath.mjs ${PORT} ${BASE_PATH}`,
    url: `http://localhost:${PORT}${BASE_PATH}/`,
    reuseExistingServer: false,
  },
});
