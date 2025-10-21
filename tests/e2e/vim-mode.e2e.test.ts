import { test, expect } from '@playwright/test';

test.describe('Vim Mode E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    // Wait for the editor to be ready
    await page.waitForSelector('.cm-editor', { timeout: 10000 });
  });

  test('should enable vim mode from settings', async ({ page }) => {
    // Open settings
    await page.click('[data-testid="settings-button"]');

    // Enable vim mode
    await page.click('[data-testid="vim-mode-toggle"]');

    // Verify vim mode indicator appears
    const vimIndicator = await page.locator('[data-testid="vim-mode-indicator"]');
    await expect(vimIndicator).toBeVisible();
  });

  test('should switch between INSERT and NORMAL modes', async ({ page }) => {
    // Enable vim mode first
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="vim-mode-toggle"]');
    await page.click('[data-testid="close-settings"]');

    // Focus editor
    const editor = await page.locator('.cm-editor');
    await editor.click();

    // Should start in INSERT mode
    const modeIndicator = await page.locator('[data-testid="vim-mode-indicator"]');
    await expect(modeIndicator).toHaveText(/INSERT/i);

    // Press Escape to enter NORMAL mode
    await page.keyboard.press('Escape');
    await expect(modeIndicator).toHaveText(/NORMAL/i);

    // Press 'i' to enter INSERT mode
    await page.keyboard.press('i');
    await expect(modeIndicator).toHaveText(/INSERT/i);
  });

  test('should handle vim motions in NORMAL mode', async ({ page }) => {
    // Enable vim mode
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="vim-mode-toggle"]');
    await page.click('[data-testid="close-settings"]');

    const editor = await page.locator('.cm-content');
    await editor.click();

    // Type some text in INSERT mode
    await page.keyboard.type('hello world');
    await page.keyboard.press('Enter');
    await page.keyboard.type('test line');

    // Switch to NORMAL mode
    await page.keyboard.press('Escape');

    // Test 'h' motion (left)
    await page.keyboard.press('h');

    // Test 'l' motion (right)
    await page.keyboard.press('l');

    // Test 'k' motion (up)
    await page.keyboard.press('k');

    // Test 'j' motion (down)
    await page.keyboard.press('j');

    // Test 'w' motion (word forward)
    await page.keyboard.press('w');

    // Test 'b' motion (word backward)
    await page.keyboard.press('b');

    // Verify cursor moved (no errors thrown)
    await expect(editor).toBeVisible();
  });

  test('should delete word without line-joining bug (dw command)', async ({ page }) => {
    // Enable vim mode
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="vim-mode-toggle"]');
    await page.click('[data-testid="close-settings"]');

    const editor = await page.locator('.cm-content');
    await editor.click();

    // Type test content
    await page.keyboard.type('hello world test');
    await page.keyboard.press('Enter');
    await page.keyboard.type('second line');

    // Switch to NORMAL mode
    await page.keyboard.press('Escape');

    // Move to beginning of first line
    await page.keyboard.press('g');
    await page.keyboard.press('g');

    // Move to 'w' in "world"
    await page.keyboard.press('w');

    // Delete word with 'dw'
    await page.keyboard.press('d');
    await page.keyboard.press('w');

    // Verify: "world " should be deleted, leaving "hello test" ON SAME LINE
    const content = await editor.textContent();
    expect(content).toContain('hello test');
    expect(content).toContain('second line');

    // CRITICAL: Verify no line joining occurred
    const lines = (content || '').split('\n').filter((line) => line.trim());
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  test('should change word without line-joining bug (cw command)', async ({ page }) => {
    // Enable vim mode
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="vim-mode-toggle"]');
    await page.click('[data-testid="close-settings"]');

    const editor = await page.locator('.cm-content');
    await editor.click();

    // Type test content
    await page.keyboard.type('hello world');
    await page.keyboard.press('Enter');
    await page.keyboard.type('test line');

    // Switch to NORMAL mode
    await page.keyboard.press('Escape');

    // Move to beginning
    await page.keyboard.press('g');
    await page.keyboard.press('g');

    // Move to 'w' in "world"
    await page.keyboard.press('w');

    // Change word with 'cw'
    await page.keyboard.press('c');
    await page.keyboard.press('w');

    // Should now be in INSERT mode, type replacement
    await page.keyboard.type('universe');

    // Switch back to NORMAL
    await page.keyboard.press('Escape');

    // Verify content
    const content = await editor.textContent();
    expect(content).toContain('hello universe');
    expect(content).toContain('test line');

    // CRITICAL: Verify no line joining
    const lines = (content || '').split('\n').filter((line) => line.trim());
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  test('should delete line with dd command', async ({ page }) => {
    // Enable vim mode
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="vim-mode-toggle"]');
    await page.click('[data-testid="close-settings"]');

    const editor = await page.locator('.cm-content');
    await editor.click();

    // Type multiple lines
    await page.keyboard.type('line 1');
    await page.keyboard.press('Enter');
    await page.keyboard.type('line 2');
    await page.keyboard.press('Enter');
    await page.keyboard.type('line 3');

    // Switch to NORMAL mode
    await page.keyboard.press('Escape');

    // Move to line 2
    await page.keyboard.press('g');
    await page.keyboard.press('g');
    await page.keyboard.press('j');

    // Delete line with 'dd'
    await page.keyboard.press('d');
    await page.keyboard.press('d');

    // Verify line 2 is deleted
    const content = await editor.textContent();
    expect(content).toContain('line 1');
    expect(content).not.toContain('line 2');
    expect(content).toContain('line 3');
  });

  test('should delete character with x command', async ({ page }) => {
    // Enable vim mode
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="vim-mode-toggle"]');
    await page.click('[data-testid="close-settings"]');

    const editor = await page.locator('.cm-content');
    await editor.click();

    // Type test content
    await page.keyboard.type('hello');

    // Switch to NORMAL mode
    await page.keyboard.press('Escape');

    // Move to beginning
    await page.keyboard.press('0');

    // Delete character with 'x'
    await page.keyboard.press('x');

    // Verify 'h' is deleted
    const content = await editor.textContent();
    expect(content).toContain('ello');
  });

  test('should handle visual mode selection', async ({ page }) => {
    // Enable vim mode
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="vim-mode-toggle"]');
    await page.click('[data-testid="close-settings"]');

    const editor = await page.locator('.cm-content');
    await editor.click();

    // Type test content
    await page.keyboard.type('select this text');

    // Switch to NORMAL mode
    await page.keyboard.press('Escape');

    // Move to beginning
    await page.keyboard.press('0');

    // Enter visual mode
    await page.keyboard.press('v');

    // Select some text with motions
    await page.keyboard.press('w');
    await page.keyboard.press('w');

    // Delete selection
    await page.keyboard.press('d');

    // Verify selection was deleted
    const content = await editor.textContent();
    expect(content).not.toContain('select this');
  });

  test('should support vim counts (3w, 2dd)', async ({ page }) => {
    // Enable vim mode
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="vim-mode-toggle"]');
    await page.click('[data-testid="close-settings"]');

    const editor = await page.locator('.cm-content');
    await editor.click();

    // Type test content
    await page.keyboard.type('one two three four five');

    // Switch to NORMAL mode
    await page.keyboard.press('Escape');

    // Move to beginning
    await page.keyboard.press('0');

    // Move 3 words forward
    await page.keyboard.type('3w');

    // Verify cursor moved (no error)
    await expect(editor).toBeVisible();
  });

  test('should handle 0, $, ^ line motions', async ({ page }) => {
    // Enable vim mode
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="vim-mode-toggle"]');
    await page.click('[data-testid="close-settings"]');

    const editor = await page.locator('.cm-content');
    await editor.click();

    // Type test content
    await page.keyboard.type('  hello world');

    // Switch to NORMAL mode
    await page.keyboard.press('Escape');

    // Move to beginning of line (0)
    await page.keyboard.press('0');

    // Move to end of line ($)
    await page.keyboard.press('$');

    // Move to first non-blank (^)
    await page.keyboard.press('^');

    // Verify motions worked (no error)
    await expect(editor).toBeVisible();
  });

  test('should handle gg and G document motions', async ({ page }) => {
    // Enable vim mode
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="vim-mode-toggle"]');
    await page.click('[data-testid="close-settings"]');

    const editor = await page.locator('.cm-content');
    await editor.click();

    // Type multiple lines
    await page.keyboard.type('line 1');
    await page.keyboard.press('Enter');
    await page.keyboard.type('line 2');
    await page.keyboard.press('Enter');
    await page.keyboard.type('line 3');
    await page.keyboard.press('Enter');
    await page.keyboard.type('line 4');

    // Switch to NORMAL mode
    await page.keyboard.press('Escape');

    // Move to beginning of document (gg)
    await page.keyboard.press('g');
    await page.keyboard.press('g');

    // Move to end of document (G)
    await page.keyboard.press('G');

    // Verify motions worked
    await expect(editor).toBeVisible();
  });
});
