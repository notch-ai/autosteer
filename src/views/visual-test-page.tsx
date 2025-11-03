import React, { useState } from 'react';
import { Button } from '@/features/shared/components/ui/Button';
import { Input, Textarea, Select } from '@/features/shared/components/ui/Input';

// Old button styles for comparison
const OldButton: React.FC<{
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}> = ({ children, variant = 'primary', disabled }) => {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 font-medium text-sm leading-none select-none no-underline px-4 py-2 border border-transparent rounded-md transition-all duration-fast outline-none';

  const variantClasses: Record<'primary' | 'secondary' | 'danger', string> = {
    primary: 'bg-[#00ffcc] text-[#0a0a0a] hover:bg-[#00d9b3] hover:shadow-sm',
    secondary: 'bg-[#2a2a2a] text-[#e0e0e0] hover:bg-[#3a3a3a]',
    danger: 'bg-[#ff4444] text-white hover:bg-[#dd3333]',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

// Old input styles for comparison
const OldInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  return (
    <input
      className="w-full font-sans text-sm px-2 py-1.5 border border-[#4a4a4a] rounded-md bg-[#1a1a1a] text-[#e0e0e0] transition-all duration-fast outline-none focus:border-[#00ffcc] focus:ring-2 focus:ring-[#00ffcc] focus:ring-opacity-25 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#2a2a2a] placeholder:text-[#808080]"
      {...props}
    />
  );
};

export const VisualTestPage: React.FC = () => {
  const [theme, setTheme] = useState<'night' | 'day'>('night');

  React.useEffect(() => {
    document.documentElement.className = `theme-${theme}`;
  }, [theme]);

  return (
    <div className="min-h-screen bg-background text-text p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold">Visual Regression Test Page</h1>
          <button
            onClick={() => setTheme(theme === 'night' ? 'day' : 'night')}
            className="px-4 py-2 bg-primary text-background rounded"
          >
            Toggle Theme ({theme})
          </button>
        </div>

        {/* Button Comparison */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Button Component</h2>

          <div className="grid grid-cols-2 gap-8">
            <div className="bg-surface p-6 rounded-lg">
              <h3 className="text-lg font-medium mb-4 text-primary">Before (Old CSS)</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-text-muted mb-2">Primary</p>
                  <OldButton variant="primary">Click me</OldButton>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-2">Secondary</p>
                  <OldButton variant="secondary">Secondary</OldButton>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-2">Danger</p>
                  <OldButton variant="danger">Delete</OldButton>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-2">Disabled</p>
                  <OldButton disabled>Disabled</OldButton>
                </div>
              </div>
            </div>

            <div className="bg-surface p-6 rounded-lg">
              <h3 className="text-lg font-medium mb-4 text-primary">After (Tailwind)</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-text-muted mb-2">Primary</p>
                  <Button variant="primary">Click me</Button>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-2">Secondary</p>
                  <Button variant="secondary">Secondary</Button>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-2">Danger</p>
                  <Button variant="danger">Delete</Button>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-2">Disabled</p>
                  <Button disabled>Disabled</Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Input Comparison */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Input Component</h2>

          <div className="grid grid-cols-2 gap-8">
            <div className="bg-surface p-6 rounded-lg">
              <h3 className="text-lg font-medium mb-4 text-primary">Before (Old CSS)</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-text-muted mb-2">Text Input</p>
                  <OldInput type="text" placeholder="Enter text..." />
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-2">Disabled</p>
                  <OldInput type="text" placeholder="Disabled" disabled />
                </div>
              </div>
            </div>

            <div className="bg-surface p-6 rounded-lg">
              <h3 className="text-lg font-medium mb-4 text-primary">After (Tailwind)</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-text-muted mb-2">Text Input</p>
                  <Input type="text" placeholder="Enter text..." />
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-2">Disabled</p>
                  <Input type="text" placeholder="Disabled" disabled />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* All Variations */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">All Component Variations</h2>

          <div className="bg-surface p-6 rounded-lg">
            <h3 className="text-lg font-medium mb-4 text-primary">Button Sizes</h3>
            <div className="space-x-4">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Icon">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </Button>
            </div>
          </div>

          <div className="bg-surface p-6 rounded-lg mt-4">
            <h3 className="text-lg font-medium mb-4 text-primary">Input Variations</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Input variant="default" placeholder="Default" />
                <Input variant="filled" placeholder="Filled" />
                <Input variant="ghost" placeholder="Ghost" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input state="default" placeholder="Default state" />
                <Input state="error" placeholder="Error state" />
                <Input state="success" placeholder="Success state" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input size="sm" placeholder="Small" />
                <Input size="md" placeholder="Medium" />
                <Input size="lg" placeholder="Large" />
              </div>
            </div>
          </div>

          <div className="bg-surface p-6 rounded-lg mt-4">
            <h3 className="text-lg font-medium mb-4 text-primary">Textarea & Select</h3>
            <div className="grid grid-cols-2 gap-4">
              <Textarea placeholder="Enter message..." rows={3} />
              <Select>
                <option>Option 1</option>
                <option>Option 2</option>
                <option>Option 3</option>
              </Select>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
