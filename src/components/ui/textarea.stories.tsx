import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Label } from './label';
import { Textarea } from './textarea';

const meta: Meta<typeof Textarea> = {
  title: 'UI/Textarea',
  component: Textarea,
  parameters: {
    layout: 'centered',
    // Test in both themes
    chromatic: {
      modes: {
        day: { className: 'theme-day' },
        night: { className: 'theme-night' },
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'filled', 'ghost'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'default', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default variant (chat input style)
export const Default: Story = {
  args: {
    placeholder: 'Type your message...',
    variant: 'default',
  },
};

// Controlled with value detection
export const ControlledWithValue: Story = {
  render: () => {
    const [value, setValue] = React.useState('');

    return (
      <div className="grid w-full gap-1.5">
        <Label htmlFor="message">Your message</Label>
        <Textarea
          placeholder="Type your message here."
          id="message"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">Characters: {value.length}</p>
      </div>
    );
  },
};

// Sizes
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <Textarea size="sm" placeholder="Small textarea" />
      <Textarea size="default" placeholder="Default textarea" />
      <Textarea size="lg" placeholder="Large textarea" />
    </div>
  ),
};

// Variants
export const Variants: Story = {
  render: () => {
    const [defaultValue, setDefaultValue] = React.useState('');
    const [filledValue, setFilledValue] = React.useState('');
    const [ghostValue, setGhostValue] = React.useState('');

    return (
      <div className="flex flex-col gap-4 w-80">
        <div>
          <Label>Default variant</Label>
          <Textarea
            variant="default"
            placeholder="Default variant"
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
          />
        </div>
        <div>
          <Label>Filled variant</Label>
          <Textarea
            variant="filled"
            placeholder="Filled variant"
            value={filledValue}
            onChange={(e) => setFilledValue(e.target.value)}
          />
        </div>
        <div>
          <Label>Ghost variant</Label>
          <Textarea
            variant="ghost"
            placeholder="Ghost variant"
            value={ghostValue}
            onChange={(e) => setGhostValue(e.target.value)}
          />
        </div>
      </div>
    );
  },
};

// States
export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <Textarea placeholder="Normal state" />
      <Textarea placeholder="Disabled state" disabled />
      <Textarea placeholder="Read only" value="Read only content" readOnly />
      <Textarea placeholder="With value" defaultValue="This has some content" />
    </div>
  ),
};

// Theme Comparison
export const ThemeComparison: Story = {
  render: () => {
    const [dayValue, setDayValue] = React.useState('');
    const [nightValue, setNightValue] = React.useState('');

    return (
      <div className="grid grid-cols-2 gap-8">
        <div className="theme-day p-6 rounded-lg bg-background border">
          <h3 className="mb-4 font-semibold text-foreground">Day Theme</h3>
          <Textarea
            placeholder="Type something..."
            value={dayValue}
            onChange={(e) => setDayValue(e.target.value)}
          />
        </div>
        <div className="theme-night p-6 rounded-lg bg-background border">
          <h3 className="mb-4 font-semibold text-foreground">Night Theme</h3>
          <Textarea
            placeholder="Type something..."
            value={nightValue}
            onChange={(e) => setNightValue(e.target.value)}
          />
        </div>
      </div>
    );
  },
};
