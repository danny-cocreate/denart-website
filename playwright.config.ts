import { defineConfig, devices } from '@playwright/test';

const webServerDefaults = {
  reuseExistingServer: !process.env.CI,
  timeout: 120000,
};

export default defineConfig({
  testDir: './tests/regression',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/regression-results.json' }],
  ],
  projects: [
    {
      name: 'chromium',
      testIgnore: /checkout-flow\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4321',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
      },
    },
    {
      name: 'chromium-booking',
      testMatch: /checkout-flow\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4322',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
      },
    },
  ],
  webServer: [
    {
      command: 'E2E_TEST_MODE=true npm run dev -- --host 127.0.0.1 --port 4321',
      url: 'http://127.0.0.1:4321',
      ...webServerDefaults,
    },
    {
      command:
        'E2E_TEST_MODE=true E2E_PRETIX_UPCOMING_SLUGS=uc-class-couples-2 npm run dev -- --host 127.0.0.1 --port 4322',
      url: 'http://127.0.0.1:4322',
      ...webServerDefaults,
    },
  ],
});
