import { test, expect } from '@playwright/experimental-ct-react';
import { Sidebar } from '@/features/shared/components/layout/Sidebar';

test.describe('Sidebar Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const mockElectron = {
        worktree: {
          getAll: async () => [],
          getDataDirectory: async () => '/test/data',
        },
      };

      (window as any).electron = mockElectron;
    });
  });

  test('@visual renders expanded state', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '280px', height: '600px', background: '#1e1e1e' }}>
        <Sidebar collapsed={false} onToggleCollapse={() => {}} />
      </div>
    );

    await page.waitForTimeout(200);

    await expect(component.locator('#app-sidebar')).toBeVisible();
    await expect(component.locator('#sidebar-content')).toBeVisible();
    await expect(component.locator('#sidebar-footer')).toBeVisible();
    await expect(page).toHaveScreenshot('sidebar-expanded.png');
  });

  test('@visual renders collapsed state', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '280px', height: '600px', background: '#1e1e1e' }}>
        <Sidebar collapsed={true} onToggleCollapse={() => {}} />
      </div>
    );

    await page.waitForTimeout(100);

    await expect(component.locator('#sidebar-content')).not.toBeVisible();
    await expect(component.locator('#sidebar-footer')).not.toBeVisible();
    await expect(page).toHaveScreenshot('sidebar-collapsed.png');
  });

  test('@visual renders footer controls', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '280px', height: '600px', background: '#1e1e1e' }}>
        <Sidebar
          collapsed={false}
          onToggleCollapse={() => {}}
          onOpenLLMSettings={() => {}}
          onOpenKeyboardShortcuts={() => {}}
        />
      </div>
    );

    await page.waitForTimeout(200);

    const footer = component.locator('#sidebar-footer');
    await expect(footer).toBeVisible();
    await expect(footer.locator('#keyboard-shortcuts-btn')).toBeVisible();
    await expect(footer.locator('#settings-btn')).toBeVisible();
    await expect(page).toHaveScreenshot('sidebar-footer-controls.png');
  });

  test('@visual renders with logout button', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '280px', height: '600px', background: '#1e1e1e' }}>
        <Sidebar
          collapsed={false}
          onToggleCollapse={() => {}}
          onOpenLLMSettings={() => {}}
          onOpenKeyboardShortcuts={() => {}}
          onLogout={() => {}}
        />
      </div>
    );

    await page.waitForTimeout(200);

    await expect(component.locator('#logout-btn')).toBeVisible();
    await expect(page).toHaveScreenshot('sidebar-with-logout.png');
  });

  test('@visual renders without logout button', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '280px', height: '600px', background: '#1e1e1e' }}>
        <Sidebar
          collapsed={false}
          onToggleCollapse={() => {}}
          onOpenLLMSettings={() => {}}
          onOpenKeyboardShortcuts={() => {}}
        />
      </div>
    );

    await page.waitForTimeout(200);

    await expect(component.locator('#logout-btn')).not.toBeVisible();
    await expect(page).toHaveScreenshot('sidebar-without-logout.png');
  });

  test('keyboard shortcuts button is clickable', async ({ mount }) => {
    let clicked = false;
    const component = await mount(
      <div style={{ width: '280px', height: '600px' }}>
        <Sidebar
          collapsed={false}
          onToggleCollapse={() => {}}
          onOpenKeyboardShortcuts={() => {
            clicked = true;
          }}
        />
      </div>
    );

    await component.locator('#keyboard-shortcuts-btn').click();
    expect(clicked).toBe(true);
  });

  test('settings button is clickable', async ({ mount }) => {
    let clicked = false;
    const component = await mount(
      <div style={{ width: '280px', height: '600px' }}>
        <Sidebar
          collapsed={false}
          onToggleCollapse={() => {}}
          onOpenLLMSettings={() => {
            clicked = true;
          }}
        />
      </div>
    );

    await component.locator('#settings-btn').click();
    expect(clicked).toBe(true);
  });

  test('logout button is clickable when provided', async ({ mount }) => {
    let clicked = false;
    const component = await mount(
      <div style={{ width: '280px', height: '600px' }}>
        <Sidebar
          collapsed={false}
          onToggleCollapse={() => {}}
          onLogout={() => {
            clicked = true;
          }}
        />
      </div>
    );

    await component.locator('#logout-btn').click();
    expect(clicked).toBe(true);
  });

  test('@visual active panel indicator', async ({ mount, page }) => {
    await page.addInitScript(() => {
      const mockStore = {
        activePanel: 'projects',
        sidebarCollapsed: false,
      };

      (window as any).__ZUSTAND_STORE__ = mockStore;
    });

    const component = await mount(
      <div style={{ width: '280px', height: '600px', background: '#1e1e1e' }}>
        <Sidebar collapsed={false} onToggleCollapse={() => {}} />
      </div>
    );

    await page.waitForTimeout(200);

    const sidebar = component.locator('#app-sidebar');
    await expect(sidebar).toHaveAttribute('data-active-panel', /.+/);
    await expect(page).toHaveScreenshot('sidebar-with-panel-indicator.png');
  });

  test('@visual error state display', async ({ mount, page }) => {
    await page.addInitScript(() => {
      const mockHandlerWithError = () => ({
        activePanel: 'chat',
        isCollapsed: false,
        activeItem: null,
        navigate: () => {},
        toggleCollapse: () => {},
        setActiveItem: () => {},
        error: 'Invalid panel: test-error',
      });

      (window as any).__MOCK_SIDEBAR_HANDLER__ = mockHandlerWithError;
    });

    const component = await mount(
      <div style={{ width: '280px', height: '600px', background: '#1e1e1e' }}>
        <Sidebar collapsed={false} onToggleCollapse={() => {}} />
      </div>
    );

    await page.waitForTimeout(200);

    await expect(component).toBeVisible();
    await expect(page).toHaveScreenshot('sidebar-error-state.png');
  });

  test('renders with correct data attributes', async ({ mount }) => {
    const component = await mount(
      <div style={{ width: '280px', height: '600px' }}>
        <Sidebar collapsed={false} onToggleCollapse={() => {}} />
      </div>
    );

    const sidebar = component.locator('#app-sidebar');
    await expect(sidebar).toHaveAttribute('data-component', 'Sidebar');
    await expect(sidebar).toHaveAttribute('data-active-panel');
    await expect(sidebar).toHaveAttribute('data-collapsed');
  });

  test('maintains layout structure when expanded', async ({ mount }) => {
    const component = await mount(
      <div style={{ width: '280px', height: '600px' }}>
        <Sidebar collapsed={false} onToggleCollapse={() => {}} />
      </div>
    );

    await expect(component.locator('.sidebar-container')).toBeVisible();
    await expect(component.locator('.sidebar-main-content')).toBeVisible();
    await expect(component.locator('.sidebar-footer-controls')).toBeVisible();
  });

  test('@visual dark mode rendering', async ({ mount, page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });

    await mount(
      <div style={{ width: '280px', height: '600px', background: '#0d1117' }}>
        <Sidebar
          collapsed={false}
          onToggleCollapse={() => {}}
          onOpenLLMSettings={() => {}}
          onOpenKeyboardShortcuts={() => {}}
          onLogout={() => {}}
        />
      </div>
    );

    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('sidebar-dark-mode.png');
  });

  test('@visual light mode rendering', async ({ mount, page }) => {
    await page.emulateMedia({ colorScheme: 'light' });

    await mount(
      <div style={{ width: '280px', height: '600px', background: '#ffffff' }}>
        <Sidebar
          collapsed={false}
          onToggleCollapse={() => {}}
          onOpenLLMSettings={() => {}}
          onOpenKeyboardShortcuts={() => {}}
          onLogout={() => {}}
        />
      </div>
    );

    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('sidebar-light-mode.png');
  });

  test('@visual responsive width', async ({ mount, page }) => {
    await mount(
      <div style={{ width: '240px', height: '600px', background: '#1e1e1e' }}>
        <Sidebar collapsed={false} onToggleCollapse={() => {}} />
      </div>
    );

    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('sidebar-narrow-width.png');
  });

  test('component unmounts cleanly', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '280px', height: '600px' }}>
        <Sidebar collapsed={false} onToggleCollapse={() => {}} />
      </div>
    );

    await page.waitForTimeout(200);

    await component.unmount();

    await page.waitForTimeout(100);
  });

  test('@visual all states showcase', async ({ mount, page }) => {
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
        <div style={{ width: '280px', height: '600px' }}>
          <Sidebar collapsed={false} onToggleCollapse={() => {}} />
        </div>
        <div style={{ width: '280px', height: '600px' }}>
          <Sidebar collapsed={true} onToggleCollapse={() => {}} />
        </div>
      </div>
    );

    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('sidebar-states-showcase.png');
  });

  test('handles missing optional callbacks', async ({ mount }) => {
    const component = await mount(
      <div style={{ width: '280px', height: '600px' }}>
        <Sidebar collapsed={false} onToggleCollapse={() => {}} />
      </div>
    );

    await expect(component.locator('#keyboard-shortcuts-btn')).toBeVisible();
    await expect(component.locator('#settings-btn')).toBeVisible();
  });

  test('@visual footer icon sizing', async ({ mount, page }) => {
    const component = await mount(
      <div style={{ width: '280px', height: '120px', background: '#1e1e1e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
          <Sidebar collapsed={false} onToggleCollapse={() => {}} />
        </div>
      </div>
    );

    await page.waitForTimeout(200);

    const icons = component.locator('.lucide');
    const count = await icons.count();
    expect(count).toBeGreaterThan(0);

    await expect(page).toHaveScreenshot('sidebar-footer-icons.png');
  });
});
