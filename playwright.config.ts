import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  use: { baseURL: 'http://127.0.0.1:4331', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: 'android-chrome',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'iphone-safari',
      use: { ...devices['iPhone 16 Pro'], browserName: 'webkit' },
    },
  ],
  webServer: {
    command: 'node tests/browser/serve.mjs',
    url: 'http://127.0.0.1:4331',
    timeout: 90000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
});
