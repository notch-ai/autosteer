import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toggle } from './toggle';

const meta: Meta<typeof Toggle> = {
  title: 'UI/Toggle',
  component: Toggle,
  parameters: {
    layout: 'centered',
    chromatic: {
      modes: {
        day: { className: 'theme-day' },
        night: { className: 'theme-night' },
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
  render: () => <Toggle>Toggle</Toggle>,
};

export const Pressed: Story = {
  args: {},
  render: () => <Toggle defaultPressed>Pressed</Toggle>,
};

export const Disabled: Story = {
  args: {},
  render: () => (
    <div className="flex gap-2">
      <Toggle disabled>Disabled</Toggle>
      <Toggle disabled defaultPressed>
        Disabled Pressed
      </Toggle>
    </div>
  ),
};

export const WithIcon: Story = {
  args: {},
  render: () => (
    <div className="flex gap-2">
      <Toggle aria-label="Toggle italic">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      </Toggle>
      <Toggle aria-label="Toggle bold">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 7h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2zM7 7V5a2 2 0 012-2h6a2 2 0 012 2v2"
          />
        </svg>
      </Toggle>
      <Toggle aria-label="Toggle underline">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
      </Toggle>
    </div>
  ),
};

export const Sizes: Story = {
  args: {},
  render: () => (
    <div className="flex items-center gap-2">
      <Toggle size="sm">Small</Toggle>
      <Toggle size="default">Default</Toggle>
      <Toggle size="lg">Large</Toggle>
    </div>
  ),
};

export const Variants: Story = {
  args: {},
  render: () => (
    <div className="flex items-center gap-2">
      <Toggle variant="default">Default</Toggle>
      <Toggle variant="outline">Outline</Toggle>
    </div>
  ),
};

export const TextFormatting: Story = {
  args: {},
  render: () => (
    <div className="flex gap-1">
      <Toggle size="sm" aria-label="Toggle bold">
        <span className="font-bold">B</span>
      </Toggle>
      <Toggle size="sm" aria-label="Toggle italic">
        <span className="italic">I</span>
      </Toggle>
      <Toggle size="sm" aria-label="Toggle underline">
        <span className="underline">U</span>
      </Toggle>
      <Toggle size="sm" aria-label="Toggle strikethrough">
        <span className="line-through">S</span>
      </Toggle>
    </div>
  ),
};

export const ThemeComparison: Story = {
  args: {},
  render: () => (
    <div className="grid grid-cols-2 gap-8">
      <div className="theme-day p-6 rounded-lg bg-background border">
        <h3 className="mb-4 font-semibold text-foreground">Day Theme</h3>
        <div className="flex gap-2">
          <Toggle>Off</Toggle>
          <Toggle defaultPressed>On</Toggle>
          <Toggle disabled>Disabled</Toggle>
        </div>
      </div>
      <div className="theme-night p-6 rounded-lg bg-background border">
        <h3 className="mb-4 font-semibold text-foreground">Night Theme</h3>
        <div className="flex gap-2">
          <Toggle>Off</Toggle>
          <Toggle defaultPressed>On</Toggle>
          <Toggle disabled>Disabled</Toggle>
        </div>
      </div>
    </div>
  ),
};
