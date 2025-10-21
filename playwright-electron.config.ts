import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests/visual/electron',
  outputDir: './tests/visual/electron-results',

  // Configure reporters
  reporter: [
    ['html', { outputFolder: './tests/visual/electron-report' }],
    ['json', { outputFile: './tests/visual/electron-results.json' }],
  ],

  // Global test settings
  use: {
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot settings for visual testing
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true,
    },

    // Video recording for debugging
    video: process.env.CI ? 'off' : 'retain-on-failure',
  },

  // Configure projects for different themes
  projects: [
    {
      name: 'electron-night',
      use: {
        // Custom test options for night theme
        theme: 'night',
      },
    },
    {
      name: 'electron-day',
      use: {
        // Custom test options for day theme
        theme: 'day',
      },
    },
  ],

  // Test timeout (longer for Electron app startup)
  timeout: 60 * 1000,

  // Retry failed tests
  retries: process.env.CI ? 2 : 0,

  // Run tests sequentially for Electron
  workers: 1,

  // Global setup to build the app if needed
  globalSetup: path.join(__dirname, 'tests/visual/electron/global-setup.ts'),

  // Global teardown to clean up
  globalTeardown: path.join(__dirname, 'tests/visual/electron/global-teardown.ts'),
});