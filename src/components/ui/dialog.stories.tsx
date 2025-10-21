import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { FaGithub, FaCodeBranch } from 'react-icons/fa';

const meta: Meta<typeof Dialog> = {
  title: 'UI/Dialog',
  component: Dialog,
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
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [name, setName] = React.useState('Pedro Duarte');
    const [username, setUsername] = React.useState('@peduarte');

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Edit Profile</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Make changes to your profile here. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                hasValue={!!name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                hasValue={!!username}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary">Cancel</Button>
            <Button>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
};

// Forms Dialog (like Create Worktree Modal)
export const FormsDialog: Story = {
  render: () => {
    const [githubUrl, setGithubUrl] = React.useState('');
    const [branchName, setBranchName] = React.useState('');

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open Form Dialog</Button>
        </DialogTrigger>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Create Worktree</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            <div>
              <Label htmlFor="github-repo" className="block text-sm font-medium text-text mb-1">
                GitHub URL
              </Label>
              <Input
                id="github-repo"
                leftIcon={<FaGithub className="w-4 h-4" />}
                placeholder="https://github.com/username/repo.git"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                hasValue={!!githubUrl}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="branch-name" className="block text-sm font-medium text-text mb-1">
                Branch
              </Label>
              <Input
                id="branch-name"
                leftIcon={<FaCodeBranch className="w-4 h-4" />}
                placeholder="feature/new-feature"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                hasValue={!!branchName}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary">Cancel</Button>
            <Button variant="primary" disabled={!githubUrl || !branchName}>
              Create Worktree
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
};

// Simple Dialog without description
export const WithoutDescription: Story = {
  render: () => {
    const [inputValue, setInputValue] = React.useState('');

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open Dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simple Dialog</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-4">
            <p>This dialog has no description.</p>
            <Input
              placeholder="Type something..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              hasValue={!!inputValue}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  },
};

// Confirmation Dialog
export const ConfirmationDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete Project</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your project and remove all
            associated data.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary">Cancel</Button>
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// Large Content Dialog with Form
export const LargeContentWithForm: Story = {
  render: () => {
    const [formData, setFormData] = React.useState({
      projectName: '',
      description: '',
      repository: '',
    });

    const handleInputChange = (field: string, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    };

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button>View Details</Button>
        </DialogTrigger>
        <DialogContent className="max-w-[720px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Project Details</DialogTitle>
            <DialogDescription>Complete information about your project</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                placeholder="Enter project name"
                value={formData.projectName}
                onChange={(e) => handleInputChange('projectName', e.target.value)}
                hasValue={!!formData.projectName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Enter description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                hasValue={!!formData.description}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repository">Repository</Label>
              <Input
                id="repository"
                leftIcon={<FaGithub className="w-4 h-4" />}
                placeholder="https://github.com/username/repo"
                value={formData.repository}
                onChange={(e) => handleInputChange('repository', e.target.value)}
                hasValue={!!formData.repository}
              />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 bg-surface rounded-md border border-border">
                <h3 className="font-medium mb-2">Section {i + 1}</h3>
                <p className="text-sm text-text-muted">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                  incididunt ut labore et dolore magna aliqua.
                </p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="secondary">Cancel</Button>
            <Button disabled={!formData.projectName || !formData.repository}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
};

// Theme Comparison
export const ThemeComparison: Story = {
  render: () => {
    const [dayInput, setDayInput] = React.useState('');
    const [nightInput, setNightInput] = React.useState('');

    return (
      <div className="grid grid-cols-2 gap-8">
        <div className="theme-day">
          <h3 className="mb-4 font-semibold text-text">Day Theme</h3>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Open Day Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Day Theme Dialog</DialogTitle>
                <DialogDescription>This dialog is rendered in day theme</DialogDescription>
              </DialogHeader>
              <div className="px-6 py-4">
                <Input
                  placeholder="Type something..."
                  value={dayInput}
                  onChange={(e) => setDayInput(e.target.value)}
                  hasValue={!!dayInput}
                />
              </div>
              <DialogFooter>
                <Button variant="secondary">Cancel</Button>
                <Button>Confirm</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="theme-night">
          <h3 className="mb-4 font-semibold text-text">Night Theme</h3>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Open Night Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Night Theme Dialog</DialogTitle>
                <DialogDescription>This dialog is rendered in night theme</DialogDescription>
              </DialogHeader>
              <div className="px-6 py-4">
                <Input
                  placeholder="Type something..."
                  value={nightInput}
                  onChange={(e) => setNightInput(e.target.value)}
                  hasValue={!!nightInput}
                />
              </div>
              <DialogFooter>
                <Button variant="secondary">Cancel</Button>
                <Button>Confirm</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  },
};
