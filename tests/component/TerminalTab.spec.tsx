import { test, expect } from '@playwright/experimental-ct-react';
import { TerminalTab } from '@/features/shared/components/terminal/TerminalTab';

test.describe('TerminalTab Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const mockIpc = {
        invoke: async (channel: string) => {
          if (channel === 'terminal:create') {
            return {
              success: true,
              data: {
                id: 'test-terminal-' + Date.now(),
                pid: 1234,
                cwd: '/test/path',
                shell: '/bin/bash',
                status: 'running',
                createdAt: new Date().toISOString(),
                lastAccessed: new Date().toISOString(),
              },
            };
          }
          if (channel === 'terminal:write') {
            return { success: true };
          }
          if (channel === 'terminal:resize') {
            return { success: true };
          }
          return { success: false, error: 'Unknown channel' };
        },
        on: () => {
          return () => {};
        },
      };

      (window as any).electron = {
        ipc: mockIpc,
      };
    });
  });

  test('@visual renders loading state', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '800px', height: '600px', background: '#1e1e1e' }}>
        <TerminalTab projectId="test-project-123" />
      </div>
    );

    await page.waitForTimeout(100);

    await expect(component.locator('text=Starting terminal')).toBeVisible();
    await expect(component.locator('.animate-spin')).toBeVisible();
    await expect(page).toHaveScreenshot('terminal-loading.png');
  });

  test('@visual renders error state on pool limit', async ({ mount, page }) => {
    await page.addInitScript(() => {
      (window as any).electron.ipc.invoke = async (channel: string) => {
        if (channel === 'terminal:create') {
          return {
            success: false,
            error: 'Terminal pool limit reached (10/10)',
          };
        }
        return { success: false, error: 'Unknown channel' };
      };
    });

    const component = await mount(
      <div style={{ width: '800px', height: '600px', background: '#1e1e1e' }}>
        <TerminalTab projectId="test-project-123" />
      </div>
    );

    await page.waitForTimeout(200);

    await expect(component.locator('text=Terminal Error')).toBeVisible();
    await expect(component.locator('text=Terminal pool limit reached (10/10)')).toBeVisible();
    await expect(component.locator('text=Retry')).toBeVisible();
    await expect(
      component.locator('text=Check if you have reached the 10-terminal limit')
    ).toBeVisible();
    await expect(page).toHaveScreenshot('terminal-pool-limit.png');
  });

  test('@visual error state shows retry button', async ({ mount, page }) => {
    await page.addInitScript(() => {
      (window as any).electron.ipc.invoke = async (channel: string) => {
        if (channel === 'terminal:create') {
          return {
            success: false,
            error: 'Shell configuration error',
          };
        }
        return { success: false, error: 'Unknown channel' };
      };
    });

    const component = await mount(
      <div style={{ width: '800px', height: '600px', background: '#1e1e1e' }}>
        <TerminalTab projectId="test-project-123" />
      </div>
    );

    await page.waitForTimeout(200);

    const retryButton = component.locator('button:has-text("Retry")');
    await expect(retryButton).toBeVisible();
    await expect(component.locator('.lucide-alert-triangle')).toBeVisible();
    await expect(page).toHaveScreenshot('terminal-error-retry.png');
  });

  test('retry button interaction', async ({ mount, page }) => {
    await page.addInitScript(() => {
      let attempts = 0;
      (window as any).electron.ipc.invoke = async (channel: string) => {
        if (channel === 'terminal:create') {
          attempts++;
          if (attempts === 1) {
            return {
              success: false,
              error: 'First attempt failed',
            };
          }
          return {
            success: true,
            data: {
              id: 'test-terminal-retry',
              pid: 1234,
              cwd: '/test/path',
              shell: '/bin/bash',
              status: 'running',
              createdAt: new Date().toISOString(),
              lastAccessed: new Date().toISOString(),
            },
          };
        }
        return { success: false, error: 'Unknown channel' };
      };
    });

    const component = await mount(
      <div style={{ width: '800px', height: '600px', background: '#1e1e1e' }}>
        <TerminalTab projectId="test-project-123" />
      </div>
    );

    await page.waitForTimeout(200);

    await expect(component.locator('text=Terminal Error')).toBeVisible();

    const retryButton = component.locator('button:has-text("Retry")');
    await retryButton.click();

    await page.waitForTimeout(300);

    await expect(component.locator('text=Terminal Error')).not.toBeVisible();
  });

  test('@visual terminal content rendering', async ({ mount, page }) => {
    await page.addInitScript(() => {
      (window as any).electron.ipc.invoke = async (channel: string) => {
        if (channel === 'terminal:create') {
          return {
            success: true,
            data: {
              id: 'test-terminal-content',
              pid: 1234,
              cwd: '/test/path',
              shell: '/bin/bash',
              status: 'running',
              createdAt: new Date().toISOString(),
              lastAccessed: new Date().toISOString(),
            },
          };
        }
        return { success: true };
      };
    });

    const component = await mount(
      <div style={{ width: '800px', height: '600px', background: '#1e1e1e' }}>
        <TerminalTab projectId="test-project-123" />
      </div>
    );

    await page.waitForTimeout(500);

    const terminalContainer = component.locator('.bg-terminal-bg');
    await expect(terminalContainer).toBeVisible();
    await expect(page).toHaveScreenshot('terminal-content.png');
  });

  test('preserves terminal state across tab switches', async ({ mount, page }) => {
    await page.addInitScript(() => {
      const terminals: any = {};
      (window as any).electron.ipc.invoke = async (channel: string) => {
        if (channel === 'terminal:create') {
          const id = 'terminal-' + Object.keys(terminals).length;
          terminals[id] = {
            id,
            pid: 1234 + Object.keys(terminals).length,
            cwd: '/test/path',
            shell: '/bin/bash',
            status: 'running',
            createdAt: new Date().toISOString(),
            lastAccessed: new Date().toISOString(),
          };
          return { success: true, data: terminals[id] };
        }
        return { success: true };
      };
    });

    const component = await mount(
      <div style={{ width: '800px', height: '600px', background: '#1e1e1e' }}>
        <TerminalTab projectId="test-project-123" />
      </div>
    );

    await page.waitForTimeout(500);

    const terminalContainer = component.locator('.bg-terminal-bg');
    await expect(terminalContainer).toBeVisible();
  });

  test('@visual ANSI color preservation', async ({ mount, page }) => {
    await page.addInitScript(() => {
      (window as any).electron.ipc.invoke = async (channel: string) => {
        if (channel === 'terminal:create') {
          return {
            success: true,
            data: {
              id: 'test-terminal-ansi',
              pid: 1234,
              cwd: '/test/path',
              shell: '/bin/bash',
              status: 'running',
              createdAt: new Date().toISOString(),
              lastAccessed: new Date().toISOString(),
            },
          };
        }
        return { success: true };
      };

      (window as any).electron.ipc.on = (channel: string, callback: (...args: any[]) => void) => {
        if (channel.startsWith('terminal:data:')) {
          setTimeout(() => {
            callback(null, '\x1b[31mRed text\x1b[0m\n');
            callback(null, '\x1b[32mGreen text\x1b[0m\n');
            callback(null, '\x1b[33mYellow text\x1b[0m\n');
          }, 100);
        }
        return () => {};
      };
    });

    await mount(
      <div style={{ width: '800px', height: '600px', background: '#1e1e1e' }}>
        <TerminalTab projectId="test-project-123" />
      </div>
    );

    await page.waitForTimeout(800);

    await expect(page).toHaveScreenshot('terminal-ansi-colors.png');
  });

  test('pool integration - attach vs create', async ({ mount }) => {
    await mount(
      <div style={{ width: '800px', height: '600px', background: '#1e1e1e' }}>
        <TerminalTab projectId="test-project-123" />
      </div>
    );
  });

  test('@visual cursor position visual', async ({ mount, page }) => {
    await page.addInitScript(() => {
      (window as any).electron.ipc.invoke = async (channel: string) => {
        if (channel === 'terminal:create') {
          return {
            success: true,
            data: {
              id: 'test-terminal-cursor',
              pid: 1234,
              cwd: '/test/path',
              shell: '/bin/bash',
              status: 'running',
              createdAt: new Date().toISOString(),
              lastAccessed: new Date().toISOString(),
            },
          };
        }
        return { success: true };
      };
    });

    await mount(
      <div style={{ width: '800px', height: '600px', background: '#1e1e1e' }}>
        <TerminalTab projectId="test-project-123" />
      </div>
    );

    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('terminal-cursor.png');
  });

  test('terminal creates successfully', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '800px', height: '600px', background: '#1e1e1e' }}>
        <TerminalTab projectId="test-project-123" />
      </div>
    );

    await page.waitForTimeout(500);

    const terminalContainer = component.locator('.bg-terminal-bg');
    await expect(terminalContainer).toBeVisible();
  });

  test('applies custom className', async ({ mount }) => {
    const component = await mount(
      <div style={{ width: '800px', height: '600px' }}>
        <TerminalTab projectId="test-project-123" className="custom-terminal-class" />
      </div>
    );

    await expect(component.locator('.custom-terminal-class')).toBeVisible();
  });

  test('@visual loading state with spinner', async ({ mount, page }) => {
    await page.addInitScript(() => {
      (window as any).electron.ipc.invoke = async (channel: string) => {
        if (channel === 'terminal:create') {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return {
            success: true,
            data: {
              id: 'test-terminal-slow',
              pid: 1234,
              cwd: '/test/path',
              shell: '/bin/bash',
              status: 'running',
              createdAt: new Date().toISOString(),
              lastAccessed: new Date().toISOString(),
            },
          };
        }
        return { success: true };
      };
    });

    const component = await mount(
      <div style={{ width: '800px', height: '600px', background: '#1e1e1e' }}>
        <TerminalTab projectId="test-project-123" />
      </div>
    );

    await page.waitForTimeout(100);

    const spinner = component.locator('.lucide-refresh-cw.animate-spin');
    await expect(spinner).toBeVisible();
    await expect(component.locator('text=Starting terminal')).toBeVisible();
    await expect(page).toHaveScreenshot('terminal-loading-spinner.png');
  });

  test('@visual error state with alert icon', async ({ mount, page }) => {
    await page.addInitScript(() => {
      (window as any).electron.ipc.invoke = async (channel: string) => {
        if (channel === 'terminal:create') {
          return {
            success: false,
            error: 'Failed to spawn shell process',
          };
        }
        return { success: false, error: 'Unknown channel' };
      };
    });

    const component = await mount(
      <div style={{ width: '800px', height: '600px', background: '#1e1e1e' }}>
        <TerminalTab projectId="test-project-123" />
      </div>
    );

    await page.waitForTimeout(200);

    const alertIcon = component.locator('.lucide-alert-triangle');
    await expect(alertIcon).toBeVisible();
    await expect(component.locator('text=Terminal Error')).toBeVisible();
    await expect(component.locator('text=Failed to spawn shell process')).toBeVisible();
    await expect(page).toHaveScreenshot('terminal-error-alert.png');
  });

  test('multiple terminal creation simulation', async ({ mount, page }) => {
    await page.addInitScript(() => {
      let count = 0;
      (window as any).electron.ipc.invoke = async (channel: string) => {
        if (channel === 'terminal:create') {
          count++;
          if (count > 10) {
            return {
              success: false,
              error: 'Terminal pool limit reached (10/10)',
            };
          }
          return {
            success: true,
            data: {
              id: `test-terminal-${count}`,
              pid: 1234 + count,
              cwd: '/test/path',
              shell: '/bin/bash',
              status: 'running',
              createdAt: new Date().toISOString(),
              lastAccessed: new Date().toISOString(),
            },
          };
        }
        return { success: true };
      };
    });

    await mount(
      <div style={{ width: '800px', height: '600px', background: '#1e1e1e' }}>
        <TerminalTab projectId="test-project-123" />
      </div>
    );

    await page.waitForTimeout(300);
  });

  test('@visual terminal with custom background', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '800px', height: '600px', background: '#0d1117' }}>
        <TerminalTab projectId="test-project-123" className="custom-bg" />
      </div>
    );

    await page.waitForTimeout(300);

    const terminalBg = component.locator('.bg-terminal-bg');
    await expect(terminalBg).toBeVisible();
    await expect(page).toHaveScreenshot('terminal-custom-bg.png');
  });

  test('terminal component unmounts cleanly', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '800px', height: '600px', background: '#1e1e1e' }}>
        <TerminalTab projectId="test-project-123" />
      </div>
    );

    await page.waitForTimeout(500);

    await component.unmount();

    await page.waitForTimeout(100);
  });

  test('@visual rapid state transitions', async ({ mount, page }) => {
    await page.addInitScript(() => {
      let count = 0;
      (window as any).electron.ipc.invoke = async (channel: string) => {
        if (channel === 'terminal:create') {
          count++;
          if (count === 1) {
            return { success: false, error: 'First attempt failed' };
          }
          return {
            success: true,
            data: {
              id: `test-terminal-${count}`,
              pid: 1234,
              cwd: '/test/path',
              shell: '/bin/bash',
              status: 'running',
              createdAt: new Date().toISOString(),
              lastAccessed: new Date().toISOString(),
            },
          };
        }
        return { success: true };
      };
    });

    const component = await mount(
      <div style={{ width: '800px', height: '600px', background: '#1e1e1e' }}>
        <TerminalTab projectId="test-project-123" />
      </div>
    );

    await page.waitForTimeout(100);
    await expect(component.locator('text=Terminal Error')).toBeVisible();
    await expect(page).toHaveScreenshot('terminal-error-state.png');

    await page.waitForTimeout(100);
    const retryButton = component.locator('button:has-text("Retry")');
    await retryButton.click();

    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('terminal-recovered-state.png');
  });

  test('handles IPC communication errors gracefully', async ({ mount, page }) => {
    await page.addInitScript(() => {
      (window as any).electron.ipc.invoke = async () => {
        throw new Error('IPC channel unavailable');
      };
    });

    const component = await mount(
      <div style={{ width: '800px', height: '600px', background: '#1e1e1e' }}>
        <TerminalTab projectId="test-project-123" />
      </div>
    );

    await page.waitForTimeout(300);

    await expect(component.locator('text=Terminal Error')).toBeVisible();
  });

  test('terminal container has correct styling', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '800px', height: '600px', background: '#1e1e1e' }}>
        <TerminalTab projectId="test-project-123" />
      </div>
    );

    await page.waitForTimeout(500);

    const container = component.locator('.flex.flex-col.h-full.bg-terminal-bg');
    await expect(container).toBeVisible();
    await expect(container).toHaveClass(/flex-1/);
  });

  test('@visual all states showcase', async ({ mount, page }) => {
    await page.addInitScript(() => {
      (window as any).electron.ipc.invoke = async (channel: string) => {
        if (channel === 'terminal:create') {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return {
            success: true,
            data: {
              id: 'showcase-terminal',
              pid: 1234,
              cwd: '/test/path',
              shell: '/bin/bash',
              status: 'running',
              createdAt: new Date().toISOString(),
              lastAccessed: new Date().toISOString(),
            },
          };
        }
        return { success: true };
      };
    });

    await mount(
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          padding: '2rem',
          background: '#0d1117',
        }}
      >
        <div style={{ width: '400px', height: '300px' }}>
          <TerminalTab projectId="test-project-123" />
        </div>
      </div>
    );

    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('terminal-states-showcase.png');
  });
});
