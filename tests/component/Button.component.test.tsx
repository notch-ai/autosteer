import { test, expect } from '@playwright/experimental-ct-react';
import { Button } from '../../src/components/features/Button';
import { FiSend, FiX } from 'react-icons/fi';

test.describe('Button Component', () => {
  test('renders with default props', async ({ mount }) => {
    const component = await mount(<Button>Click me</Button>);
    await expect(component).toContainText('Click me');
    await expect(component).toBeVisible();
  });

  test('renders with primary variant', async ({ mount }) => {
    const component = await mount(<Button variant="primary">Primary</Button>);
    await expect(component).toContainText('Primary');
    await expect(component).toBeVisible();
  });

  test('renders with secondary variant', async ({ mount }) => {
    const component = await mount(<Button variant="secondary">Secondary</Button>);
    await expect(component).toContainText('Secondary');
    await expect(component).toBeVisible();
  });

  test('renders with danger variant', async ({ mount }) => {
    const component = await mount(<Button variant="danger">Delete</Button>);
    await expect(component).toContainText('Delete');
    await expect(component).toBeVisible();
  });

  test('renders with ghost variant', async ({ mount }) => {
    const component = await mount(<Button variant="ghost">Ghost</Button>);
    await expect(component).toContainText('Ghost');
    await expect(component).toBeVisible();
  });

  test('renders with different sizes', async ({ mount }) => {
    const small = await mount(<Button size="sm">Small</Button>);
    await expect(small).toContainText('Small');

    const medium = await mount(<Button size="md">Medium</Button>);
    await expect(medium).toContainText('Medium');

    const large = await mount(<Button size="lg">Large</Button>);
    await expect(large).toContainText('Large');
  });

  test('renders with left icon', async ({ mount }) => {
    const component = await mount(
      <Button leftIcon={<FiSend data-testid="left-icon" />}>Send Message</Button>
    );
    await expect(component).toContainText('Send Message');
    await expect(component.locator('[data-testid="left-icon"]')).toBeVisible();
  });

  test('renders with right icon', async ({ mount }) => {
    const component = await mount(
      <Button rightIcon={<FiX data-testid="right-icon" />}>Close</Button>
    );
    await expect(component).toContainText('Close');
    await expect(component.locator('[data-testid="right-icon"]')).toBeVisible();
  });

  test('shows loading state', async ({ mount }) => {
    const component = await mount(
      <Button loading loadingText="Loading...">
        Submit
      </Button>
    );
    await expect(component).toContainText('Loading...');
    await expect(component.locator('.animate-spin')).toBeVisible();
  });

  test('hides icons when loading', async ({ mount }) => {
    const component = await mount(
      <Button loading leftIcon={<FiSend data-testid="left-icon" />}>
        Send
      </Button>
    );
    await expect(component.locator('[data-testid="left-icon"]')).not.toBeVisible();
    await expect(component.locator('.animate-spin')).toBeVisible();
  });

  test('is disabled when disabled prop is true', async ({ mount }) => {
    const component = await mount(<Button disabled>Disabled</Button>);
    await expect(component).toBeDisabled();
  });

  test('is disabled when loading', async ({ mount }) => {
    const component = await mount(<Button loading>Loading</Button>);
    await expect(component).toBeDisabled();
  });

  test('handles click events', async ({ mount }) => {
    let clicked = false;
    const component = await mount(<Button onClick={() => (clicked = true)}>Click Me</Button>);
    await component.click();
    expect(clicked).toBe(true);
  });

  test('does not trigger click when disabled', async ({ mount }) => {
    let clicked = false;
    const component = await mount(
      <Button disabled onClick={() => (clicked = true)}>
        Disabled
      </Button>
    );
    await component.click({ force: true });
    expect(clicked).toBe(false);
  });

  test('applies custom className', async ({ mount }) => {
    const component = await mount(<Button className="custom-class">Custom</Button>);
    await expect(component).toHaveClass(/custom-class/);
  });

  test('@visual renders all variants correctly', async ({ mount, page }: any) => {
    const component = await mount(
      <div style={{ display: 'flex', gap: '1rem', padding: '2rem', background: 'white' }}>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </div>
    );
    await expect(component).toBeVisible();
    await expect(page).toHaveScreenshot('button-variants.png');
  });

  test('@visual renders all sizes correctly', async ({ mount, page }: any) => {
    const component = await mount(
      <div style={{ display: 'flex', gap: '1rem', padding: '2rem', background: 'white' }}>
        <Button size="sm" variant="primary">
          Small
        </Button>
        <Button size="md" variant="primary">
          Medium
        </Button>
        <Button size="lg" variant="primary">
          Large
        </Button>
      </div>
    );
    await expect(component).toBeVisible();
    await expect(page).toHaveScreenshot('button-sizes.png');
  });

  test('@visual renders loading state correctly', async ({ mount, page }: any) => {
    const component = await mount(
      <div style={{ display: 'flex', gap: '1rem', padding: '2rem', background: 'white' }}>
        <Button loading variant="primary">
          Loading
        </Button>
        <Button loading loadingText="Processing..." variant="primary">
          Submit
        </Button>
      </div>
    );
    await expect(component).toBeVisible();
    await expect(page).toHaveScreenshot('button-loading.png');
  });
});
