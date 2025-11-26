import type { Meta, StoryObj } from '@storybook/react-vite';
import { Progress } from './progress';

const meta: Meta<typeof Progress> = {
  title: 'UI/Progress',
  component: Progress,
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
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 100, step: 10 },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 60,
    className: 'w-[300px]',
  },
};

export const Empty: Story = {
  args: {
    value: 0,
    className: 'w-[300px]',
  },
};

export const Complete: Story = {
  args: {
    value: 100,
    className: 'w-[300px]',
  },
};

export const Various: Story = {
  args: {},
  render: () => (
    <div className="space-y-4 w-[300px]">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Loading...</span>
          <span>25%</span>
        </div>
        <Progress value={25} />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Processing...</span>
          <span>50%</span>
        </div>
        <Progress value={50} />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Almost done...</span>
          <span>75%</span>
        </div>
        <Progress value={75} />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Complete!</span>
          <span>100%</span>
        </div>
        <Progress value={100} />
      </div>
    </div>
  ),
};

export const Sizes: Story = {
  args: {},
  render: () => (
    <div className="space-y-4">
      <Progress value={60} className="w-[200px] h-2" />
      <Progress value={60} className="w-[300px] h-3" />
      <Progress value={60} className="w-[400px] h-4" />
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
          <Progress value={20} className="w-full" />
          <Progress value={50} className="w-full" />
          <Progress value={80} className="w-full" />
        </div>
      </div>
      <div className="theme-night p-6 rounded-lg bg-background border">
        <h3 className="mb-4 font-semibold text-foreground">Night Theme</h3>
        <div className="space-y-3">
          <Progress value={20} className="w-full" />
          <Progress value={50} className="w-full" />
          <Progress value={80} className="w-full" />
        </div>
      </div>
    </div>
  ),
};
