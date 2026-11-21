import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e-connected",
  use: { baseURL: process.env.TEST_APP_URL || "http://localhost:3000" },
  webServer: process.env.TEST_APP_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
      },
  reporter: "list",
});
