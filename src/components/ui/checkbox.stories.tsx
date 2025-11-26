import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './checkbox';
import { Label } from './label';

const meta: Meta<typeof Checkbox> = {
  title: 'UI/Checkbox',
  component: Checkbox,
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
  render: () => <Checkbox />,
};

export const Checked: Story = {
  args: {},
  render: () => <Checkbox checked />,
};

export const WithLabel: Story = {
  args: {},
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="terms" />
      <Label htmlFor="terms">Accept terms and conditions</Label>
    </div>
  ),
};

export const Disabled: Story = {
  args: {},
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center space-x-2">
        <Checkbox id="disabled-unchecked" disabled />
        <Label htmlFor="disabled-unchecked" className="text-muted-foreground">
          Disabled unchecked
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="disabled-checked" disabled checked />
        <Label htmlFor="disabled-checked" className="text-muted-foreground">
          Disabled checked
        </Label>
      </div>
    </div>
  ),
};

export const FormExample: Story = {
  args: {},
  render: () => (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <Checkbox id="marketing" defaultChecked />
        <Label htmlFor="marketing">Send me marketing emails</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="security" defaultChecked />
        <Label htmlFor="security">Send me security updates</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="updates" />
        <Label htmlFor="updates">Send me product updates</Label>
      </div>
    </div>
  ),
};

export const ThemeComparison: Story = {
  args: {},
  render: () => (
    <div className="grid grid-cols-2 gap-8">
      <div className="theme-day p-6 rounded-lg bg-background border">
        <h3 className="mb-4 font-semibold text-foreground">Day Theme</h3>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox id="day-1" defaultChecked />
            <Label htmlFor="day-1">Checked option</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="day-2" />
            <Label htmlFor="day-2">Unchecked option</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="day-3" disabled />
            <Label htmlFor="day-3" className="text-muted-foreground">
              Disabled option
            </Label>
          </div>
        </div>
      </div>
      <div className="theme-night p-6 rounded-lg bg-background border">
        <h3 className="mb-4 font-semibold text-foreground">Night Theme</h3>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox id="night-1" defaultChecked />
            <Label htmlFor="night-1">Checked option</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="night-2" />
            <Label htmlFor="night-2">Unchecked option</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="night-3" disabled />
            <Label htmlFor="night-3" className="text-muted-foreground">
              Disabled option
            </Label>
          </div>
        </div>
      </div>
    </div>
  ),
};
