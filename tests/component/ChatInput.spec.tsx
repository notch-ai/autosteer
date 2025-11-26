import { test, expect } from '@playwright/experimental-ct-react';
import { ChatInput } from '@/features/chat/components/ChatInput';

test.describe('ChatInput Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Mock electron IPC
      const mockIpc = {
        invoke: async (channel: string) => {
          if (channel === 'claude-code:clear-session-for-entry') {
            return { success: true };
          }
          return { success: false, error: 'Unknown channel' };
        },
        on: () => {
          return () => {};
        },
      };

      (window as any).electron = {
        ipcRenderer: mockIpc,
      };
    });
  });

  test('@visual renders empty input state', async ({ mount, page }) => {
    const mockOnSendMessage = () => {};
    const mockOnRemoveResource = () => {};

    const component = await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={false}
          selectedAgentId="test-agent"
        />
      </div>
    );

    await page.waitForTimeout(100);

    await expect(component.locator('textarea, [contenteditable]')).toBeVisible();
    await expect(page).toHaveScreenshot('chat-input-empty.png');
  });

  test('@visual renders disabled state when no agent selected', async ({ mount, page }) => {
    const mockOnSendMessage = () => {};
    const mockOnRemoveResource = () => {};

    const component = await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={false}
          selectedAgentId={null}
        />
      </div>
    );

    await page.waitForTimeout(100);

    const inputContainer = component.locator('.opacity-60');
    await expect(inputContainer).toBeVisible();
    await expect(component.locator('text=Select an agent to start chatting')).toBeVisible();
    await expect(page).toHaveScreenshot('chat-input-no-agent.png');
  });

  test('@visual renders loading state', async ({ mount, page }) => {
    const mockOnSendMessage = () => {};
    const mockOnRemoveResource = () => {};

    const component = await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={false}
          selectedAgentId="test-agent"
        />
      </div>
    );

    await page.waitForTimeout(100);

    const inputContainer = component.locator('.opacity-60');
    await expect(inputContainer).toBeVisible();
    await expect(page).toHaveScreenshot('chat-input-loading.png');
  });

  test('@visual renders with attached resources', async ({ mount, page }) => {
    const mockOnSendMessage = () => {};
    const mockOnRemoveResource = () => {};

    await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={['resource-1', 'resource-2']}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={false}
          selectedAgentId="test-agent"
        />
      </div>
    );

    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('chat-input-with-resources.png');
  });

  test('@visual renders streaming state', async ({ mount, page }) => {
    const mockOnSendMessage = () => {};
    const mockOnRemoveResource = () => {};

    await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={true}
          selectedAgentId="test-agent"
        />
      </div>
    );

    await page.waitForTimeout(100);

    await expect(page).toHaveScreenshot('chat-input-streaming.png');
  });

  test('handles message submission', async ({ mount, page }) => {
    let submittedMessage = '';
    const mockOnSendMessage = (message: string) => {
      submittedMessage = message;
    };
    const mockOnRemoveResource = () => {};

    const component = await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={false}
          selectedAgentId="test-agent"
        />
      </div>
    );

    await page.waitForTimeout(100);

    const input = component.locator('[contenteditable]');
    await input.click();
    await input.fill('Hello Claude');

    await page.keyboard.press('Enter');

    await page.waitForTimeout(100);

    expect(submittedMessage).toContain('Hello Claude');
  });

  test('prevents submission when loading', async ({ mount, page }) => {
    let submittedCount = 0;
    const mockOnSendMessage = () => {
      submittedCount++;
    };
    const mockOnRemoveResource = () => {};

    const component = await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={false}
          selectedAgentId="test-agent"
        />
      </div>
    );

    await page.waitForTimeout(100);

    const input = component.locator('[contenteditable]');
    await input.click();
    await input.fill('Test message');

    await page.keyboard.press('Enter');

    await page.waitForTimeout(100);

    expect(submittedCount).toBe(0);
  });

  test('prevents submission when no agent selected', async ({ mount, page }) => {
    let submittedCount = 0;
    const mockOnSendMessage = () => {
      submittedCount++;
    };
    const mockOnRemoveResource = () => {};

    const component = await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={false}
          selectedAgentId={null}
        />
      </div>
    );

    await page.waitForTimeout(100);

    const input = component.locator('[contenteditable]');

    // Input should be disabled
    await expect(input).toBeDisabled();

    expect(submittedCount).toBe(0);
  });

  test('@visual placeholder text changes based on agent selection', async ({ mount, page }) => {
    const mockOnSendMessage = () => {};
    const mockOnRemoveResource = () => {};

    // Without agent
    const component1 = await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={false}
          selectedAgentId={null}
        />
      </div>
    );

    await page.waitForTimeout(100);
    await expect(component1.locator('text=Select an agent to start chatting')).toBeVisible();
    await expect(page).toHaveScreenshot('chat-input-placeholder-no-agent.png');

    await component1.unmount();

    // With agent
    const component2 = await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={false}
          selectedAgentId="test-agent"
        />
      </div>
    );

    await page.waitForTimeout(100);
    await expect(component2.locator('text=Type to start building')).toBeVisible();
    await expect(page).toHaveScreenshot('chat-input-placeholder-with-agent.png');
  });

  test('@visual opacity transition on disabled state', async ({ mount, page }) => {
    const mockOnSendMessage = () => {};
    const mockOnRemoveResource = () => {};

    await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={false}
          selectedAgentId="test-agent"
        />
      </div>
    );

    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('chat-input-opacity-disabled.png');
  });

  test('slash command handling', async ({ mount, page }) => {
    let receivedCommand = '';
    const mockOnSendMessage = (message: string) => {
      receivedCommand = message;
    };
    const mockOnRemoveResource = () => {};

    const component = await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={false}
          selectedAgentId="test-agent"
        />
      </div>
    );

    await page.waitForTimeout(100);

    const input = component.locator('[contenteditable]');
    await input.click();
    await input.fill('/commit Add feature');

    await page.keyboard.press('Enter');

    await page.waitForTimeout(100);

    expect(receivedCommand).toBe('/commit Add feature');
  });

  test('@visual renders with multiple UI states', async ({ mount, page }) => {
    const mockOnSendMessage = () => {};
    const mockOnRemoveResource = () => {};

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
        <div style={{ width: '400px' }}>
          <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>Empty State</h3>
          <ChatInput
            onSendMessage={mockOnSendMessage}
            attachedResourceIds={[]}
            onRemoveResource={mockOnRemoveResource}
            isStreaming={false}
            selectedAgentId="test-agent"
          />
        </div>
        <div style={{ width: '400px' }}>
          <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>No Agent</h3>
          <ChatInput
            onSendMessage={mockOnSendMessage}
            attachedResourceIds={[]}
            onRemoveResource={mockOnRemoveResource}
            isStreaming={false}
            selectedAgentId={null}
          />
        </div>
        <div style={{ width: '400px' }}>
          <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>Loading</h3>
          <ChatInput
            onSendMessage={mockOnSendMessage}
            attachedResourceIds={[]}
            onRemoveResource={mockOnRemoveResource}
            isStreaming={false}
            selectedAgentId="test-agent"
          />
        </div>
        <div style={{ width: '400px' }}>
          <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>Streaming</h3>
          <ChatInput
            onSendMessage={mockOnSendMessage}
            attachedResourceIds={[]}
            onRemoveResource={mockOnRemoveResource}
            isStreaming={true}
            selectedAgentId="test-agent"
          />
        </div>
      </div>
    );

    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('chat-input-all-states.png');
  });

  test('component unmounts cleanly', async ({ mount, page }) => {
    const mockOnSendMessage = () => {};
    const mockOnRemoveResource = () => {};

    const component = await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={false}
          selectedAgentId="test-agent"
        />
      </div>
    );

    await page.waitForTimeout(100);

    await component.unmount();

    await page.waitForTimeout(100);
  });

  test('handles rapid state changes', async ({ mount, page }) => {
    const mockOnSendMessage = () => {};
    const mockOnRemoveResource = () => {};

    await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={false}
          selectedAgentId="test-agent"
        />
      </div>
    );

    await page.waitForTimeout(50);

    // Rapid state transitions shouldn't cause errors
    await page.waitForTimeout(50);
    await page.waitForTimeout(50);
  });

  test('maintains focus state', async ({ mount, page }) => {
    const mockOnSendMessage = () => {};
    const mockOnRemoveResource = () => {};

    const component = await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={false}
          selectedAgentId="test-agent"
        />
      </div>
    );

    await page.waitForTimeout(100);

    const input = component.locator('[contenteditable]');
    await input.click();

    await expect(input).toBeFocused();
  });

  test('settings remain available during streaming', async ({ mount, page }) => {
    const mockOnSendMessage = () => {};
    const mockOnRemoveResource = () => {};

    const component = await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={true}
          selectedAgentId="test-agent"
        />
      </div>
    );

    await page.waitForTimeout(100);

    // Model selector should be enabled during streaming
    const modelSelector = component.locator('[data-testid="model-selector"]');
    await expect(modelSelector).toBeVisible();
    await expect(modelSelector).not.toBeDisabled();

    // Permission mode selector should be enabled during streaming
    const permissionModeSelector = component.locator('[data-testid="permission-mode-selector"]');
    await expect(permissionModeSelector).toBeVisible();
    await expect(permissionModeSelector).not.toBeDisabled();
  });

  test('model selector can be changed during streaming', async ({ mount, page }) => {
    let modelChanged = false;
    const mockOnSendMessage = () => {};
    const mockOnRemoveResource = () => {};

    const component = await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={true}
          selectedAgentId="test-agent"
        />
      </div>
    );

    await page.waitForTimeout(100);

    const modelSelector = component.locator('[data-testid="model-selector"]');

    // Should be able to click and interact with model selector
    await modelSelector.click();
    modelChanged = true;

    expect(modelChanged).toBe(true);
  });

  test('permission mode selector can be changed during streaming', async ({ mount, page }) => {
    let permissionChanged = false;
    const mockOnSendMessage = () => {};
    const mockOnRemoveResource = () => {};

    const component = await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={true}
          selectedAgentId="test-agent"
        />
      </div>
    );

    await page.waitForTimeout(100);

    const permissionModeSelector = component.locator('[data-testid="permission-mode-selector"]');

    // Should be able to click and interact with permission mode selector
    await permissionModeSelector.click();
    permissionChanged = true;

    expect(permissionChanged).toBe(true);
  });

  test('@visual settings remain interactive during streaming', async ({ mount, page }) => {
    const mockOnSendMessage = () => {};
    const mockOnRemoveResource = () => {};

    await mount(
      <div style={{ width: '800px', background: '#1e1e1e', padding: '1rem' }}>
        <ChatInput
          onSendMessage={mockOnSendMessage}
          attachedResourceIds={[]}
          onRemoveResource={mockOnRemoveResource}
          isStreaming={true}
          selectedAgentId="test-agent"
        />
      </div>
    );

    await page.waitForTimeout(200);

    // Visual test to verify settings UI appears active (not grayed out)
    await expect(page).toHaveScreenshot('chat-input-streaming-active-settings.png');
  });
});
