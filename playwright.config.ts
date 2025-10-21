import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/test-results',
  
  // Configure reporters
  reporter: [
    ['html', { outputFolder: './tests/e2e/playwright-report' }],
    ['json', { outputFile: './tests/e2e/results.json' }],
  ],
  
  // Global test settings
  use: {
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot settings for user journey testing
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true,
    },
  },
  
  // Configure projects for Electron testing
  projects: [
    {
      name: 'electron-e2e',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  
  // Test timeout (longer for Electron startup)
  timeout: 60 * 1000,
  
  // Retry failed tests
  retries: process.env.CI ? 2 : 0,
  
  // Run sequentially for Electron resource management
  workers: 1,
});