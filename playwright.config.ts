import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:3001",
    viewport: { width: 390, height: 844 },
    headless: true,
  },
  workers: 1,
});
