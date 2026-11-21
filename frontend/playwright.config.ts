import { defineConfig } from "@playwright/test";
export default defineConfig({
  workers: 1,
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: process.env.CHROMIUM_EXECUTABLE_PATH
      ? {
          executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote",
          ],
        }
      : undefined,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    // These tests cover the unconfigured site; empty values beat any .env.local.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SECRET_KEY: "",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  reporter: "list",
});
