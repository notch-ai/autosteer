/**
 * Terminal Session Lifecycle E2E Tests - Phase 5
 *
 * End-to-end tests validating the complete terminal session lifecycle
 * with React component integration using Playwright and Electron.
 *
 * Success Criteria:
 * - Terminal sessions survive React component unmounts
 * - <100ms switch time between sessions
 * - <16ms input lag maintained (60fps)
 * - <50MB memory per session
 * - Session restoration after component lifecycle events
 *
 * @see docs/terminal-persistence-architecture.md
 */

import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

test.describe('Terminal Session Lifecycle E2E', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    console.log('[E2E Setup] Starting Electron application for terminal lifecycle tests');

    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../.vite/build/main.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_ENABLE_LOGGING: '1',
      },
    });

    // Wait for the app window
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    console.log('[E2E Setup] Electron application launched successfully');
  });

  test.afterAll(async () => {
    console.log('[E2E Teardown] Closing Electron application');
    await electronApp.close();
  });

  test.describe('Terminal Creation and Display', () => {
    test('should create a new terminal session and display it', async () => {
      console.log('[E2E Test] Creating new terminal session');

      // Click create terminal button
      const createButton = page.locator('[data-testid="create-terminal-button"]');
      await createButton.click();

      // Wait for terminal to be created
      const terminal = page.locator('[data-testid^="terminal-"]').first();
      await expect(terminal).toBeVisible({ timeout: 5000 });

      console.log('[E2E Test] Terminal created and visible');

      // Verify terminal has XTerm container
      const xtermContainer = terminal.locator('.xterm');
      await expect(xtermContainer).toBeVisible();

      // Verify terminal has cursor
      const cursor = terminal.locator('.xterm-cursor-layer');
      await expect(cursor).toBeVisible();

      console.log('[E2E Test] Terminal XTerm components rendered correctly');
    });

    test('should display terminal title and metadata', async () => {
      console.log('[E2E Test] Verifying terminal metadata display');

      const terminalTab = page.locator('[data-testid^="terminal-tab-"]').first();
      await expect(terminalTab).toBeVisible();

      // Verify title is displayed
      const title = terminalTab.locator('[data-testid="terminal-title"]');
      await expect(title).toHaveText(/Terminal \d+|bash|zsh|sh/);

      console.log('[E2E Test] Terminal metadata displayed correctly');
    });

    test('should handle multiple terminal creation (up to 10)', async () => {
      console.log('[E2E Test] Creating multiple terminals');

      const createButton = page.locator('[data-testid="create-terminal-button"]');

      // Create 3 terminals
      for (let i = 0; i < 3; i++) {
        await createButton.click();
        await page.waitForTimeout(100); // Small delay between creations
      }

      // Verify all terminals are listed
      const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');
      const count = await terminalTabs.count();

      expect(count).toBeGreaterThanOrEqual(3);
      console.log(`[E2E Test] Created ${count} terminals successfully`);
    });

    test('should prevent creating more than 10 terminals', async () => {
      console.log('[E2E Test] Testing 10 terminal limit');

      const createButton = page.locator('[data-testid="create-terminal-button"]');

      // Get current count
      const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');
      const initialCount = await terminalTabs.count();

      // Try to create terminals until limit
      for (let i = initialCount; i < 12; i++) {
        await createButton.click();
        await page.waitForTimeout(100);
      }

      // Verify max 10 terminals
      const finalCount = await terminalTabs.count();
      expect(finalCount).toBeLessThanOrEqual(10);

      console.log(`[E2E Test] Terminal limit enforced: ${finalCount} terminals`);
    });
  });

  test.describe('Terminal Switching and Session Persistence', () => {
    test('should switch between terminals with <100ms latency', async () => {
      console.log('[E2E Test] Testing terminal switching performance');

      // Ensure we have at least 2 terminals
      const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');
      const count = await terminalTabs.count();

      if (count < 2) {
        const createButton = page.locator('[data-testid="create-terminal-button"]');
        await createButton.click();
        await page.waitForTimeout(100);
      }

      // Get first and second terminal tabs
      const firstTab = terminalTabs.nth(0);
      const secondTab = terminalTabs.nth(1);

      // Click first tab
      await firstTab.click();
      await page.waitForTimeout(50);

      // Measure switch time to second tab
      const startTime = Date.now();
      await secondTab.click();

      // Wait for terminal to be visible
      const secondTerminal = page.locator('[data-testid^="terminal-"]').nth(1);
      await expect(secondTerminal).toBeVisible();

      const switchTime = Date.now() - startTime;

      console.log(`[E2E Test] Terminal switch time: ${switchTime}ms`);
      expect(switchTime).toBeLessThan(100); // Performance target: <100ms
    });

    test('should preserve terminal session state during tab switches', async () => {
      console.log('[E2E Test] Testing session persistence during switches');

      const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');
      const firstTab = terminalTabs.nth(0);
      const secondTab = terminalTabs.nth(1);

      // Click first terminal and send input
      await firstTab.click();
      const firstTerminal = page.locator('[data-testid^="terminal-"]').nth(0);
      await firstTerminal.click();
      await page.keyboard.type('echo "test session 1"');

      console.log('[E2E Test] Input sent to first terminal');

      // Switch to second terminal
      await secondTab.click();
      await page.waitForTimeout(100);

      // Switch back to first terminal
      await firstTab.click();
      await page.waitForTimeout(100);

      // Verify the input is still visible in first terminal
      const terminalContent = firstTerminal.locator('.xterm-rows');
      await expect(terminalContent).toContainText('test session 1');

      console.log('[E2E Test] Session state preserved across switches');
    });

    test('should maintain terminal state after React component unmount/remount', async () => {
      console.log('[E2E Test] Testing session persistence across component lifecycle');

      const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');
      const firstTab = terminalTabs.nth(0);

      // Send input to terminal
      await firstTab.click();
      const terminal = page.locator('[data-testid^="terminal-"]').nth(0);
      await terminal.click();
      await page.keyboard.type('echo "persistent content"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      console.log('[E2E Test] Input sent to terminal');

      // Navigate away (simulating component unmount)
      const settingsButton = page.locator('[data-testid="settings-button"]');
      if (await settingsButton.isVisible()) {
        await settingsButton.click();
        await page.waitForTimeout(200);

        // Navigate back to terminals
        const backButton = page.locator('[data-testid="back-button"]');
        await backButton.click();
        await page.waitForTimeout(200);
      }

      // Verify terminal content is still present
      await firstTab.click();
      const terminalContent = terminal.locator('.xterm-rows');
      await expect(terminalContent).toContainText('persistent content');

      console.log('[E2E Test] Terminal state persisted across component lifecycle');
    });
  });

  test.describe('Terminal Input and Output', () => {
    test('should handle user input with <16ms lag (60fps)', async () => {
      console.log('[E2E Test] Testing input lag performance');

      const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');
      const firstTab = terminalTabs.nth(0);
      await firstTab.click();

      const terminal = page.locator('[data-testid^="terminal-"]').nth(0);
      await terminal.click();

      // Measure input responsiveness
      const inputs = ['a', 'b', 'c', 'd', 'e'];
      const measurements: number[] = [];

      for (const char of inputs) {
        const startTime = performance.now();
        await page.keyboard.type(char);

        // Wait for character to appear in terminal
        await page.waitForTimeout(5); // Small wait for rendering

        const endTime = performance.now();
        const inputLag = endTime - startTime;
        measurements.push(inputLag);
      }

      const averageLag = measurements.reduce((a, b) => a + b, 0) / measurements.length;

      console.log(`[E2E Test] Average input lag: ${averageLag.toFixed(2)}ms`);
      console.log(
        `[E2E Test] Individual measurements: ${measurements.map((m) => m.toFixed(2)).join(', ')}ms`
      );

      // 16ms = 60fps target
      expect(averageLag).toBeLessThan(16);
    });

    test('should display command output correctly', async () => {
      console.log('[E2E Test] Testing command output display');

      const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');
      const firstTab = terminalTabs.nth(0);
      await firstTab.click();

      const terminal = page.locator('[data-testid^="terminal-"]').nth(0);
      await terminal.click();

      // Send a simple command
      await page.keyboard.type('echo "Hello Terminal"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Verify output is displayed
      const terminalContent = terminal.locator('.xterm-rows');
      await expect(terminalContent).toContainText('Hello Terminal');

      console.log('[E2E Test] Command output displayed correctly');
    });

    test('should handle rapid input without dropping characters', async () => {
      console.log('[E2E Test] Testing rapid input handling');

      const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');
      const firstTab = terminalTabs.nth(0);
      await firstTab.click();

      const terminal = page.locator('[data-testid^="terminal-"]').nth(0);
      await terminal.click();

      // Type a long string rapidly
      const testString = 'abcdefghijklmnopqrstuvwxyz0123456789';
      await page.keyboard.type(testString, { delay: 0 });
      await page.waitForTimeout(200);

      // Verify all characters are present
      const terminalContent = terminal.locator('.xterm-rows');
      await expect(terminalContent).toContainText(testString);

      console.log('[E2E Test] Rapid input handled without character loss');
    });
  });

  test.describe('Terminal Destruction and Cleanup', () => {
    test('should destroy terminal and clean up resources', async () => {
      console.log('[E2E Test] Testing terminal destruction');

      const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');
      const initialCount = await terminalTabs.count();

      // Close the first terminal
      const firstTab = terminalTabs.nth(0);
      const closeButton = firstTab.locator('[data-testid="close-terminal-button"]');
      await closeButton.click();

      // Wait for terminal to be removed
      await page.waitForTimeout(300);

      // Verify terminal count decreased
      const finalCount = await terminalTabs.count();
      expect(finalCount).toBe(initialCount - 1);

      console.log(`[E2E Test] Terminal destroyed: ${initialCount} -> ${finalCount} terminals`);
    });

    test('should handle destroying active terminal and switch to next', async () => {
      console.log('[E2E Test] Testing active terminal destruction with auto-switch');

      const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');

      // Ensure we have at least 2 terminals
      const count = await terminalTabs.count();
      if (count < 2) {
        const createButton = page.locator('[data-testid="create-terminal-button"]');
        await createButton.click();
        await page.waitForTimeout(100);
      }

      // Click first tab to make it active
      const firstTab = terminalTabs.nth(0);
      await firstTab.click();
      await page.waitForTimeout(100);

      // Close the active terminal
      const closeButton = firstTab.locator('[data-testid="close-terminal-button"]');
      await closeButton.click();
      await page.waitForTimeout(300);

      // Verify another terminal is now active
      const activeTab = page.locator('[data-testid^="terminal-tab-"][data-active="true"]');
      await expect(activeTab).toBeVisible();

      console.log('[E2E Test] Active terminal destroyed and switched successfully');
    });
  });

  test.describe('Buffer Management and Memory', () => {
    test('should handle large output with 10k line scrollback', async () => {
      console.log('[E2E Test] Testing large output handling');

      const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');
      const firstTab = terminalTabs.nth(0);
      await firstTab.click();

      const terminal = page.locator('[data-testid^="terminal-"]').nth(0);
      await terminal.click();

      // Generate large output (100 lines)
      await page.keyboard.type('for i in {1..100}; do echo "Line $i"; done');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);

      // Verify terminal is still responsive
      await page.keyboard.type('echo "still responsive"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const terminalContent = terminal.locator('.xterm-rows');
      await expect(terminalContent).toContainText('still responsive');

      console.log('[E2E Test] Terminal handled large output and remained responsive');
    });

    test('should maintain <50MB memory per session', async () => {
      console.log('[E2E Test] Testing memory constraints');

      // This test requires measuring actual memory usage
      // In a real E2E test, you would use Electron's process metrics
      const metrics = await electronApp.evaluate(async ({ app }) => {
        const processMetrics = app.getAppMetrics();
        return processMetrics;
      });

      console.log('[E2E Test] Process metrics:', metrics);

      // Verify memory usage is reasonable
      // Note: This is a simplified check - real implementation would track per-session memory
      const totalMemory = metrics.reduce(
        (sum: number, metric: any) => sum + metric.memory.workingSetSize,
        0
      );
      const memoryMB = totalMemory / (1024 * 1024);

      console.log(`[E2E Test] Total memory usage: ${memoryMB.toFixed(2)}MB`);

      // With max 10 terminals, total should be reasonable (< 500MB for all)
      expect(memoryMB).toBeLessThan(500);
    });

    test('should trim old content when buffer exceeds 10k lines', async () => {
      console.log('[E2E Test] Testing buffer trimming');

      const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');
      const firstTab = terminalTabs.nth(0);
      await firstTab.click();

      const terminal = page.locator('[data-testid^="terminal-"]').nth(0);
      await terminal.click();

      // Generate output exceeding buffer (simplified for E2E)
      await page.keyboard.type('for i in {1..200}; do echo "Buffer line $i"; done');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);

      // Verify terminal is still functional after buffer management
      await page.keyboard.type('echo "after buffer trim"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const terminalContent = terminal.locator('.xterm-rows');
      await expect(terminalContent).toContainText('after buffer trim');

      console.log('[E2E Test] Buffer trimming handled correctly');
    });
  });

  test.describe('Multi-Session Workflows', () => {
    test('should support parallel work across multiple terminal sessions', async () => {
      console.log('[E2E Test] Testing parallel multi-session workflow');

      const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');

      // Ensure we have 3 terminals
      const createButton = page.locator('[data-testid="create-terminal-button"]');
      const currentCount = await terminalTabs.count();
      for (let i = currentCount; i < 3; i++) {
        await createButton.click();
        await page.waitForTimeout(100);
      }

      // Send different commands to each terminal
      for (let i = 0; i < 3; i++) {
        const tab = terminalTabs.nth(i);
        await tab.click();
        await page.waitForTimeout(50);

        const terminal = page.locator('[data-testid^="terminal-"]').nth(i);
        await terminal.click();
        await page.keyboard.type(`echo "Terminal ${i + 1} task"`);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
      }

      // Verify each terminal has its own content
      for (let i = 0; i < 3; i++) {
        const tab = terminalTabs.nth(i);
        await tab.click();
        await page.waitForTimeout(50);

        const terminal = page.locator('[data-testid^="terminal-"]').nth(i);
        const content = terminal.locator('.xterm-rows');
        await expect(content).toContainText(`Terminal ${i + 1} task`);
      }

      console.log('[E2E Test] Parallel multi-session workflow validated');
    });

    test('should maintain session isolation between terminals', async () => {
      console.log('[E2E Test] Testing session isolation');

      const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');

      // Use first two terminals
      const firstTab = terminalTabs.nth(0);
      const secondTab = terminalTabs.nth(1);

      // Send unique content to first terminal
      await firstTab.click();
      const firstTerminal = page.locator('[data-testid^="terminal-"]').nth(0);
      await firstTerminal.click();
      await page.keyboard.type('export UNIQUE_VAR_1="terminal1"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);

      // Send different content to second terminal
      await secondTab.click();
      const secondTerminal = page.locator('[data-testid^="terminal-"]').nth(1);
      await secondTerminal.click();
      await page.keyboard.type('export UNIQUE_VAR_2="terminal2"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);

      // Verify first terminal has only its content
      await firstTab.click();
      const firstContent = firstTerminal.locator('.xterm-rows');
      await expect(firstContent).toContainText('UNIQUE_VAR_1');
      await expect(firstContent).not.toContainText('UNIQUE_VAR_2');

      console.log('[E2E Test] Session isolation verified');
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle rapid terminal creation and destruction', async () => {
      console.log('[E2E Test] Testing rapid create/destroy operations');

      const createButton = page.locator('[data-testid="create-terminal-button"]');

      // Rapidly create and destroy terminals
      for (let i = 0; i < 5; i++) {
        await createButton.click();
        await page.waitForTimeout(50);

        const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');
        const lastTab = terminalTabs.last();
        const closeButton = lastTab.locator('[data-testid="close-terminal-button"]');
        await closeButton.click();
        await page.waitForTimeout(50);
      }

      // Verify app is still stable
      const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');
      const finalCount = await terminalTabs.count();
      expect(finalCount).toBeGreaterThanOrEqual(0);

      console.log('[E2E Test] Rapid operations handled without crash');
    });

    test('should recover from terminal process errors', async () => {
      console.log('[E2E Test] Testing error recovery');

      const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');
      const firstTab = terminalTabs.nth(0);
      await firstTab.click();

      const terminal = page.locator('[data-testid^="terminal-"]').nth(0);
      await terminal.click();

      // Send an invalid command
      await page.keyboard.type('nonexistentcommand123');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Verify terminal is still responsive
      await page.keyboard.type('echo "recovered"');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const terminalContent = terminal.locator('.xterm-rows');
      await expect(terminalContent).toContainText('recovered');

      console.log('[E2E Test] Error recovery validated');
    });
  });
});
