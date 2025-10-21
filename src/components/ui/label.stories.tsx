import type { Meta, StoryObj } from '@storybook/react-vite';
import { Label } from './label';

const meta: Meta<typeof Label> = {
  title: 'UI/Label',
  component: Label,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Label',
  },
};

export const Required: Story = {
  render: () => (
    <Label>
      Email <span className="text-red-500">*</span>
    </Label>
  ),
};

export const Disabled: Story = {
  args: {
    children: 'Disabled Label',
    className: 'text-muted-foreground',
  },
};
