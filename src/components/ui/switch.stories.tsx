import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from './switch';
import { Label } from './label';

const meta: Meta<typeof Switch> = {
  title: 'UI/Switch',
  component: Switch,
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
  render: () => <Switch />,
};

export const Checked: Story = {
  args: {},
  render: () => <Switch defaultChecked />,
};

export const WithLabel: Story = {
  args: {},
  render: () => (
    <div className="flex items-center space-x-2">
      <Switch id="airplane-mode" />
      <Label htmlFor="airplane-mode">Airplane Mode</Label>
    </div>
  ),
};

export const Disabled: Story = {
  args: {},
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center space-x-2">
        <Switch id="disabled-off" disabled />
        <Label htmlFor="disabled-off" className="text-muted-foreground">
          Disabled (Off)
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <Switch id="disabled-on" disabled defaultChecked />
        <Label htmlFor="disabled-on" className="text-muted-foreground">
          Disabled (On)
        </Label>
      </div>
    </div>
  ),
};

export const FormExample: Story = {
  args: {},
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="notifications">Notifications</Label>
          <p className="text-sm text-muted-foreground">Receive notifications about your account</p>
        </div>
        <Switch id="notifications" defaultChecked />
      </div>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="marketing">Marketing emails</Label>
          <p className="text-sm text-muted-foreground">Receive emails about new products</p>
        </div>
        <Switch id="marketing" />
      </div>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="security">Security alerts</Label>
          <p className="text-sm text-muted-foreground">Get notified about security issues</p>
        </div>
        <Switch id="security" defaultChecked />
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
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Switch id="day-1" defaultChecked />
            <Label htmlFor="day-1">Enabled</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="day-2" />
            <Label htmlFor="day-2">Disabled</Label>
          </div>
        </div>
      </div>
      <div className="theme-night p-6 rounded-lg bg-background border">
        <h3 className="mb-4 font-semibold text-foreground">Night Theme</h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Switch id="night-1" defaultChecked />
            <Label htmlFor="night-1">Enabled</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="night-2" />
            <Label htmlFor="night-2">Disabled</Label>
          </div>
        </div>
      </div>
    </div>
  ),
};
