import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './input';
import { FaSearch, FaUser, FaLock, FaEnvelope, FaGithub, FaCodeBranch } from 'react-icons/fa';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
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
    type: {
      control: { type: 'select' },
      options: ['text', 'email', 'password', 'number', 'tel', 'url', 'search'],
    },
    variant: {
      control: { type: 'select' },
      options: ['default', 'filled', 'ghost'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'default', 'lg'],
    },
    state: {
      control: { type: 'select' },
      options: ['default', 'error', 'success'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
};

// Input types
export const InputTypes: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <Input type="text" placeholder="Text input" />
      <Input type="email" placeholder="Email address" />
      <Input type="password" placeholder="Password" />
      <Input type="number" placeholder="Number" />
      <Input type="tel" placeholder="Phone number" />
      <Input type="url" placeholder="Website URL" />
      <Input type="search" placeholder="Search..." />
    </div>
  ),
};

// States
export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <Input placeholder="Normal state" />
      <Input placeholder="Disabled state" disabled />
      <Input placeholder="With value" defaultValue="Hello world" />
      <Input placeholder="Read only" defaultValue="Read only text" readOnly />
    </div>
  ),
};

// With values
export const WithValues: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <Input type="email" defaultValue="user@example.com" />
      <Input type="password" defaultValue="password123" />
      <Input type="tel" defaultValue="+1 (555) 123-4567" />
      <Input type="url" defaultValue="https://example.com" />
    </div>
  ),
};

// File input
export const FileInput: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <Input type="file" />
      <Input type="file" accept="image/*" />
      <Input type="file" accept=".pdf,.doc,.docx" />
      <Input type="file" multiple />
    </div>
  ),
};

// Theme comparison
export const ThemeComparison: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8">
      <div className="theme-day p-6 rounded-lg bg-background border">
        <h3 className="mb-4 font-semibold text-text">Day Theme</h3>
        <div className="flex flex-col gap-3">
          <Input placeholder="Normal input" />
          <Input placeholder="With value" defaultValue="Hello world" />
          <Input placeholder="Disabled" disabled />
          <Input type="email" placeholder="Email address" />
          <Input type="password" placeholder="Password" defaultValue="secret" />
        </div>
      </div>
      <div className="theme-night p-6 rounded-lg bg-background border">
        <h3 className="mb-4 font-semibold text-text">Night Theme</h3>
        <div className="flex flex-col gap-3">
          <Input placeholder="Normal input" />
          <Input placeholder="With value" defaultValue="Hello world" />
          <Input placeholder="Disabled" disabled />
          <Input type="email" placeholder="Email address" />
          <Input type="password" placeholder="Password" defaultValue="secret" />
        </div>
      </div>
    </div>
  ),
};

// Focus states (interactive)
export const FocusStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <div>
        <label className="text-sm text-text-muted mb-1 block">Click to focus:</label>
        <Input placeholder="Focus me" />
      </div>
      <div>
        <label className="text-sm text-text-muted mb-1 block">Hover to see hover state:</label>
        <Input placeholder="Hover over me" />
      </div>
    </div>
  ),
};

// Form example
export const FormExample: Story = {
  render: () => (
    <form className="flex flex-col gap-4 w-80">
      <div>
        <label htmlFor="name" className="text-sm font-medium text-text mb-1 block">
          Name
        </label>
        <Input id="name" leftIcon={<FaUser className="w-4 h-4" />} placeholder="John Doe" />
      </div>
      <div>
        <label htmlFor="email" className="text-sm font-medium text-text mb-1 block">
          Email
        </label>
        <Input
          id="email"
          type="email"
          leftIcon={<FaEnvelope className="w-4 h-4" />}
          placeholder="john@example.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium text-text mb-1 block">
          Password
        </label>
        <Input
          id="password"
          type="password"
          leftIcon={<FaLock className="w-4 h-4" />}
          placeholder="Enter password"
        />
      </div>
      <div>
        <label htmlFor="search" className="text-sm font-medium text-text mb-1 block">
          Search
        </label>
        <Input
          id="search"
          leftIcon={<FaSearch className="w-4 h-4" />}
          placeholder="Search for anything..."
        />
      </div>
    </form>
  ),
};

// Sizes
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <Input size="sm" placeholder="Small input" />
      <Input size="default" placeholder="Default input" />
      <Input size="lg" placeholder="Large input" />
    </div>
  ),
};

// Variants
export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <Input variant="default" placeholder="Default variant" />
      <Input variant="filled" placeholder="Filled variant" />
      <Input variant="ghost" placeholder="Ghost variant" />
    </div>
  ),
};

// With Icons
export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <Input leftIcon={<FaSearch className="w-4 h-4" />} placeholder="Search..." />
      <Input leftIcon={<FaUser className="w-4 h-4" />} placeholder="Username" />
      <Input
        leftIcon={<FaEnvelope className="w-4 h-4" />}
        type="email"
        placeholder="Email address"
      />
      <Input
        leftIcon={<FaLock className="w-4 h-4" />}
        type="password"
        placeholder="Password"
        rightIcon={<button className="text-text-muted hover:text-text">Show</button>}
      />
    </div>
  ),
};

// Create Worktree Style
export const CreateWorktreeStyle: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-full max-w-md p-6 bg-surface rounded-lg border border-border">
      <div>
        <label htmlFor="github-repo" className="block text-sm font-medium text-text mb-1">
          GitHub URL
        </label>
        <Input
          id="github-repo"
          leftIcon={<FaGithub className="w-4 h-4" />}
          placeholder="https://github.com/username/repo.git"
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="branch-name" className="block text-sm font-medium text-text mb-1">
          Branch
        </label>
        <Input
          id="branch-name"
          leftIcon={<FaCodeBranch className="w-4 h-4" />}
          placeholder="feature/new-feature"
        />
      </div>
    </div>
  ),
};

// Error and Success States
export const ValidationStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <Input state="default" placeholder="Default state" />
      <Input state="error" placeholder="Error state" />
      <Input state="success" placeholder="Success state" />
      <Input
        state="error"
        leftIcon={<FaEnvelope className="w-4 h-4" />}
        placeholder="Invalid email"
        defaultValue="not-an-email"
      />
      <Input
        state="success"
        leftIcon={<FaUser className="w-4 h-4" />}
        placeholder="Username available"
        defaultValue="john_doe"
      />
    </div>
  ),
};

// Edge cases
export const EdgeCases: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <Input placeholder="Very long placeholder text that might overflow the input field boundaries" />
      <Input defaultValue="Very long value text that might overflow the input field boundaries when displayed" />
      <Input type="number" min="0" max="100" step="10" placeholder="0-100" />
      <Input pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" placeholder="123-456-7890" />
      <Input maxLength={10} placeholder="Max 10 chars" />
    </div>
  ),
};
