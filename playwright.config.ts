import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a production build. The app talks to a mock of
 * the City's API (e2e/mock-activenet.mjs) instead of the real one.
 *
 *   npm run e2e
 */
const APP_PORT = 3100;
const MOCK_PORT = 3101;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  timeout: 45_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "phone",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: [
    {
      command: `node e2e/mock-activenet.mjs ${MOCK_PORT}`,
      port: MOCK_PORT,
      reuseExistingServer: !CI,
    },
    {
      command: `npm run build && npx next start -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}/centres`,
      env: { ACTIVENET_BASE_URL: `http://127.0.0.1:${MOCK_PORT}` },
      timeout: 240_000,
      reuseExistingServer: !CI,
    },
  ],
});
