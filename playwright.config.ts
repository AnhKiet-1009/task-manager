import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:15173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @taskmanager/api exec tsx src/server.ts",
      url: "http://127.0.0.1:18787/health",
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        HOST: "127.0.0.1",
        PORT: "18787",
        PGLITE_MEMORY: "1",
        CORS_ORIGIN: "http://127.0.0.1:15173,http://localhost:15173",
        BETTER_AUTH_URL: "http://127.0.0.1:18787",
        BETTER_AUTH_SECRET: "e2e-test-secret-32-chars-minimum-key",
        GITHUB_WEBHOOK_SECRET: "e2e-webhook-secret",
      },
    },
    {
      command:
        "pnpm --filter @taskmanager/web exec vite --host 127.0.0.1 --port 15173 --strictPort",
      url: "http://127.0.0.1:15173",
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        VITE_API_PROXY_TARGET: "http://127.0.0.1:18787",
        VITE_API_URL: "",
      },
    },
  ],
});
