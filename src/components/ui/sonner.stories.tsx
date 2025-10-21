import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
import { Toaster, toast, toastSuccess, toastError, toastWarning, toastInfo } from './sonner';
import { FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';

const meta: Meta<typeof Toaster> = {
  title: 'UI/Sonner',
  component: Toaster,
  parameters: {
    // Test in both themes
    chromatic: {
      modes: {
        day: { className: 'theme-day' },
        night: { className: 'theme-night' },
      },
    },
  },
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster position="top-right" />
      </>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default toast
export const Default: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button onClick={() => toast('This is a default toast', { icon: false })}>
        Show Default Toast
      </Button>
    </div>
  ),
};

// All toast types
export const AllTypes: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => toast('Default toast', { icon: false })}>Default</Button>
        <Button onClick={() => toastSuccess('Success! Operation completed')}>Success</Button>
        <Button onClick={() => toastError('Error! Something went wrong')}>Error</Button>
        <Button onClick={() => toastWarning('Warning! Please be careful')}>Warning</Button>
        <Button onClick={() => toastInfo('Info: Here is some information')}>Info</Button>
      </div>
    </div>
  ),
};

// Toast with description
export const WithDescription: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button
        onClick={() =>
          toast('Event Created', {
            description: 'Monday, January 3rd at 6:00pm',
            icon: false,
          })
        }
      >
        Show Toast with Description
      </Button>
    </div>
  ),
};

// Toast with action button
export const WithAction: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button
        onClick={() =>
          toast('Event Created', {
            description: 'Monday, January 3rd at 6:00pm',
            action: {
              label: 'Undo',
              onClick: () => console.log('Undo clicked'),
            },
            icon: false,
          })
        }
      >
        Show Toast with Action
      </Button>
    </div>
  ),
};

// Toast with cancel button
export const WithCancel: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button
        onClick={() =>
          toast('Are you sure?', {
            description: 'This action cannot be undone',
            cancel: {
              label: 'Cancel',
              onClick: () => console.log('Cancel clicked'),
            },
            action: {
              label: 'Confirm',
              onClick: () => console.log('Confirmed'),
            },
            icon: false,
          })
        }
      >
        Show Toast with Cancel
      </Button>
    </div>
  ),
};

// Promise toast
export const PromiseToast: Story = {
  render: () => {
    const simulatePromise = () => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const success = Math.random() > 0.5;
          if (success) {
            resolve('Data loaded successfully');
          } else {
            reject('Failed to load data');
          }
        }, 2000);
      });
    };

    return (
      <div className="flex gap-2">
        <Button
          onClick={() => {
            const promise = simulatePromise();
            toast.promise(promise, {
              loading: 'Loading data...',
            });
            promise
              .then(() => toastSuccess('Data loaded successfully!'))
              .catch(() => toastError('Failed to load data'));
          }}
        >
          Show Promise Toast (50/50 success)
        </Button>
      </div>
    );
  },
};

// Custom styled toast
export const CustomStyled: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button
        onClick={() =>
          toast('Custom Styled Toast', {
            description: 'This toast has custom styling',
            style: {
              background: 'linear-gradient(to right, #00b8b8, #00a0a0)',
              color: 'white',
              border: 'none',
            },
            icon: false,
          })
        }
      >
        Show Custom Styled Toast
      </Button>
    </div>
  ),
};

// Loading toast
export const LoadingToast: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button
        onClick={() => {
          const toastId = toast.loading('Loading...');
          setTimeout(() => {
            toastSuccess('Loaded!', {
              id: toastId,
            });
          }, 2000);
        }}
      >
        Show Loading Toast (2s)
      </Button>
    </div>
  ),
};

// Theme comparison
export const ThemeComparison: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8">
      <div className="theme-day p-4 rounded bg-background">
        <h3 className="mb-4 font-semibold">Day Theme</h3>
        <div className="flex flex-col gap-2">
          <Button onClick={() => toast('Day theme toast', { icon: false })}>Default</Button>
          <Button onClick={() => toastSuccess('Success in day theme')}>Success</Button>
          <Button onClick={() => toastError('Error in day theme')}>Error</Button>
        </div>
      </div>
      <div className="theme-night p-4 rounded bg-background">
        <h3 className="mb-4 font-semibold">Night Theme</h3>
        <div className="flex flex-col gap-2">
          <Button onClick={() => toast('Night theme toast', { icon: false })}>Default</Button>
          <Button onClick={() => toastSuccess('Success in night theme')}>Success</Button>
          <Button onClick={() => toastError('Error in night theme')}>Error</Button>
        </div>
      </div>
    </div>
  ),
};

// Position options
export const Positions: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            toast('Top Left', {
              position: 'top-left',
              icon: false,
            });
          }}
        >
          Top Left
        </Button>
        <Button
          onClick={() => {
            toast('Top Center', {
              position: 'top-center',
              icon: false,
            });
          }}
        >
          Top Center
        </Button>
        <Button
          onClick={() => {
            toast('Top Right', {
              position: 'top-right',
              icon: false,
            });
          }}
        >
          Top Right
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            toast('Bottom Left', {
              position: 'bottom-left',
              icon: false,
            });
          }}
        >
          Bottom Left
        </Button>
        <Button
          onClick={() => {
            toast('Bottom Center', {
              position: 'bottom-center',
              icon: false,
            });
          }}
        >
          Bottom Center
        </Button>
        <Button
          onClick={() => {
            toast('Bottom Right', {
              position: 'bottom-right',
              icon: false,
            });
          }}
        >
          Bottom Right
        </Button>
      </div>
    </div>
  ),
};

// Icon variants showcase
export const IconVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-lg font-semibold">Toast Variants with Font Awesome Icons</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => toastSuccess('Task completed successfully!')}
            className="justify-start"
          >
            <FaCheckCircle className="w-4 h-4 mr-2 text-green" />
            Success Toast
          </Button>
          <Button onClick={() => toastError('An error occurred')} className="justify-start">
            <FaTimesCircle className="w-4 h-4 mr-2 text-red" />
            Error Toast
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={() => toastWarning('Please check your input')} className="justify-start">
            <FaExclamationTriangle className="w-4 h-4 mr-2 text-orange" />
            Warning Toast
          </Button>
          <Button onClick={() => toastInfo('New update available')} className="justify-start">
            <FaInfoCircle className="w-4 h-4 mr-2 text-blue" />
            Info Toast
          </Button>
        </div>
      </div>
    </div>
  ),
};
