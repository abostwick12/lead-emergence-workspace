import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    browserName: "chromium",
    headless: true,
    serviceWorkers: "block",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
