import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
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
      options: [
        'default',
        'primary',
        'secondary',
        'ghost',
        'destructive',
        'outline',
        'link',
        'brand',
        'icon-secondary',
        'danger',
      ],
    },
    size: {
      control: { type: 'select' },
      options: ['default', 'sm', 'lg', 'icon', 'icon-sm', 'icon-lg'],
    },
    icon: {
      control: { type: 'select' },
      options: [
        'plus',
        'edit',
        'trash',
        'download',
        'upload',
        'settings',
        'search',
        'check',
        'close',
      ],
    },
    iconPosition: {
      control: { type: 'radio' },
      options: ['left', 'right'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  args: {
    children: 'Button',
  },
};

// All variants
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex gap-2 items-center">
        <Button variant="default">Default</Button>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="link">Link</Button>
      </div>
    </div>
  ),
};

// All sizes
export const AllSizes: Story = {
  render: () => (
    <div className="flex gap-2 items-center">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" icon="plus" />
      <Button size="icon-sm" icon="edit" />
      <Button size="icon-lg" icon="settings" />
    </div>
  ),
};

// States
export const States: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button>Normal</Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
};

// Theme comparison
export const ThemeComparison: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8">
      <div className="theme-day p-6 rounded-lg bg-background border">
        <h3 className="mb-4 font-semibold text-text">Day Theme</h3>
        <div className="flex flex-col gap-2">
          <Button variant="default">Default</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
      </div>
      <div className="theme-night p-6 rounded-lg bg-background border">
        <h3 className="mb-4 font-semibold text-text">Night Theme</h3>
        <div className="flex flex-col gap-2">
          <Button variant="default">Default</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
      </div>
    </div>
  ),
};

// Individual variant stories
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Action',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Delete',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost',
  },
};

export const Link: Story = {
  args: {
    variant: 'link',
    children: 'Link',
  },
};

// Size stories
export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large',
  },
};

export const IconDefault: Story = {
  args: {
    size: 'icon',
    icon: 'plus',
  },
};

export const IconSecondary: Story = {
  args: {
    size: 'icon',
    icon: 'settings',
    variant: 'icon-secondary',
  },
};

// Buttons with icons
export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 items-center">
        <Button icon="plus">Add Item</Button>
        <Button icon="edit" variant="secondary">
          Edit
        </Button>
        <Button icon="trash" variant="destructive">
          Delete
        </Button>
        <Button icon="download" variant="outline">
          Download
        </Button>
      </div>
      <div className="flex gap-2 items-center">
        <Button icon="upload" iconPosition="right">
          Upload File
        </Button>
        <Button icon="settings" iconPosition="right" variant="ghost">
          Settings
        </Button>
        <Button icon="search" iconPosition="left" variant="primary">
          Search
        </Button>
      </div>
      <div className="flex gap-2 items-center">
        <Button size="icon" icon="plus" variant="primary" title="Add new item" />
        <Button size="icon" icon="edit" variant="secondary" title="Edit" />
        <Button size="icon" icon="trash" variant="destructive" title="Delete" />
        <Button size="icon" icon="settings" variant="icon-secondary" title="Settings" />
        <Button size="icon" icon="bell" variant="icon-secondary" title="Notifications" />
      </div>
    </div>
  ),
};

// Icon sizes
export const IconSizes: Story = {
  render: () => (
    <div className="flex gap-2 items-center">
      <Button size="sm" icon="plus">
        Small
      </Button>
      <Button size="default" icon="plus">
        Default
      </Button>
      <Button size="lg" icon="plus">
        Large
      </Button>
      <Button size="icon-sm" icon="plus" title="Small icon" />
      <Button size="icon" icon="plus" title="Default icon" />
      <Button size="icon-lg" icon="plus" title="Large icon" />
    </div>
  ),
};

// Sidebar-style icon buttons
export const SidebarIcons: Story = {
  render: () => (
    <div className="bg-surface p-4 rounded-lg">
      <h3 className="text-sm font-medium text-text mb-3">Sidebar Style Icons</h3>
      <div className="flex gap-2 items-center">
        <Button size="icon" icon="settings" variant="icon-secondary" title="Settings" />
        <Button size="icon" icon="circle-question" variant="icon-secondary" title="Help" />
        <Button size="icon" icon="bell" variant="icon-secondary" title="Notifications" />
        <Button size="icon" icon="info" variant="icon-secondary" title="Info" />
      </div>
    </div>
  ),
};

// Brand variant buttons
export const BrandVariant: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 items-center">
        <Button variant="brand">Create Worktree</Button>
        <Button variant="brand" icon="plus">
          Add New
        </Button>
        <Button variant="brand" icon="git">
          Create Branch
        </Button>
      </div>
      <div className="flex gap-2 items-center">
        <Button variant="brand" disabled>
          Disabled Brand
        </Button>
        <Button variant="brand" disabled icon="plus">
          Disabled With Icon
        </Button>
      </div>
      <div className="flex gap-2 items-center">
        <Button variant="brand" size="sm">
          Small Brand
        </Button>
        <Button variant="brand" size="default">
          Default Brand
        </Button>
        <Button variant="brand" size="lg">
          Large Brand
        </Button>
      </div>
    </div>
  ),
};
