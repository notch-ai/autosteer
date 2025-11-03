import React, { useState } from 'react';
import { Button } from '@/features/shared/components/ui/Button';
import { Input } from '@/features/shared/components/ui/Input';
import { Icon } from '@/features/shared/components/ui/Icon';

export const VisualComparisonTool: React.FC = () => {
  const [activeComponent, setActiveComponent] = useState<'button' | 'input'>('button');
  const [showGrid, setShowGrid] = useState(true);

  return (
    <div className="min-h-screen bg-background text-text p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Visual Component Comparison Tool</h1>
        <p className="text-gray-400 mb-6">
          Since components were created directly with Tailwind, this tool helps verify all variants
          are working correctly.
        </p>

        {/* Controls */}
        <div className="flex gap-4 mb-6">
          <Button
            variant={activeComponent === 'button' ? 'primary' : 'secondary'}
            onClick={() => setActiveComponent('button')}
          >
            Button Components
          </Button>
          <Button
            variant={activeComponent === 'input' ? 'primary' : 'secondary'}
            onClick={() => setActiveComponent('input')}
          >
            Input Components
          </Button>
          <Button variant="ghost" onClick={() => setShowGrid(!showGrid)}>
            {showGrid ? 'Hide' : 'Show'} Grid
          </Button>
        </div>
      </div>

      {/* Component Display */}
      {activeComponent === 'button' && (
        <div className="space-y-8">
          <h2 className="text-2xl font-semibold">Button Variants</h2>

          {/* Variants */}
          <section>
            <h3 className="text-lg font-medium mb-4 text-gray-300">Variants</h3>
            <div className={`${showGrid ? 'grid grid-cols-4 gap-4' : 'flex flex-wrap gap-4'}`}>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Primary</p>
                <Button variant="primary">Primary Button</Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Secondary</p>
                <Button variant="secondary">Secondary Button</Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Ghost</p>
                <Button variant="ghost">Ghost Button</Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Danger</p>
                <Button variant="danger">Danger Button</Button>
              </div>
            </div>
          </section>

          {/* Sizes */}
          <section>
            <h3 className="text-lg font-medium mb-4 text-gray-300">Sizes</h3>
            <div
              className={`${showGrid ? 'grid grid-cols-4 gap-4' : 'flex flex-wrap gap-4 items-end'}`}
            >
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Small</p>
                <Button size="sm">Small Button</Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Medium (default)</p>
                <Button size="md">Medium Button</Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Large</p>
                <Button size="lg">Large Button</Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Icon</p>
                <Button size="icon">
                  <Icon name="settings" size={20} />
                </Button>
              </div>
            </div>
          </section>

          {/* States */}
          <section>
            <h3 className="text-lg font-medium mb-4 text-gray-300">States</h3>
            <div className={`${showGrid ? 'grid grid-cols-3 gap-4' : 'flex flex-wrap gap-4'}`}>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Normal</p>
                <Button>Normal State</Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Disabled</p>
                <Button disabled>Disabled State</Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Loading</p>
                <Button disabled>
                  <span className="animate-pulse">Loading...</span>
                </Button>
              </div>
            </div>
          </section>

          {/* Combinations */}
          <section>
            <h3 className="text-lg font-medium mb-4 text-gray-300">Common Combinations</h3>
            <div className={`${showGrid ? 'grid grid-cols-3 gap-4' : 'flex flex-wrap gap-4'}`}>
              <Button variant="primary" size="lg">
                <Icon name="file" size={16} className="mr-2" />
                Sign In
              </Button>
              <Button variant="danger" size="sm">
                <Icon name="close" size={14} className="mr-1" />
                Delete
              </Button>
              <Button variant="ghost" disabled>
                Disabled Ghost
              </Button>
            </div>
          </section>
        </div>
      )}

      {activeComponent === 'input' && (
        <div className="space-y-8">
          <h2 className="text-2xl font-semibold">Input Variants</h2>

          {/* Variants */}
          <section>
            <h3 className="text-lg font-medium mb-4 text-gray-300">Variants</h3>
            <div className={`${showGrid ? 'grid grid-cols-3 gap-4' : 'space-y-4'} max-w-3xl`}>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Default</p>
                <Input variant="default" placeholder="Default input" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Filled</p>
                <Input variant="filled" placeholder="Filled input" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Ghost</p>
                <Input variant="ghost" placeholder="Ghost input" />
              </div>
            </div>
          </section>

          {/* States */}
          <section>
            <h3 className="text-lg font-medium mb-4 text-gray-300">States</h3>
            <div className={`${showGrid ? 'grid grid-cols-3 gap-4' : 'space-y-4'} max-w-3xl`}>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Error</p>
                <Input state="error" placeholder="Error state" defaultValue="Invalid input" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Success</p>
                <Input state="success" placeholder="Success state" defaultValue="Valid input" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Disabled</p>
                <Input disabled placeholder="Disabled input" />
              </div>
            </div>
          </section>

          {/* Sizes */}
          <section>
            <h3 className="text-lg font-medium mb-4 text-gray-300">Sizes</h3>
            <div className={`${showGrid ? 'grid grid-cols-3 gap-4' : 'space-y-4'} max-w-3xl`}>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Small</p>
                <Input size="sm" placeholder="Small input" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Medium (default)</p>
                <Input size="md" placeholder="Medium input" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Large</p>
                <Input size="lg" placeholder="Large input" />
              </div>
            </div>
          </section>

          {/* With Icons */}
          <section>
            <h3 className="text-lg font-medium mb-4 text-gray-300">With Icons</h3>
            <div className={`${showGrid ? 'grid grid-cols-2 gap-4' : 'space-y-4'} max-w-2xl`}>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Left Icon</p>
                <Input placeholder="Search..." leftIcon={<Icon name="search" size={16} />} />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Right Icon</p>
                <Input
                  placeholder="Password"
                  type="password"
                  rightIcon={<Icon name="file" size={16} />}
                />
              </div>
            </div>
          </section>

          {/* Input Types */}
          <section>
            <h3 className="text-lg font-medium mb-4 text-gray-300">Input Types</h3>
            <div className={`${showGrid ? 'grid grid-cols-3 gap-4' : 'space-y-4'} max-w-3xl`}>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Email</p>
                <Input type="email" placeholder="email@example.com" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Number</p>
                <Input type="number" placeholder="123" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Date</p>
                <Input type="date" />
              </div>
            </div>
          </section>

          {/* Combinations */}
          <section>
            <h3 className="text-lg font-medium mb-4 text-gray-300">Common Combinations</h3>
            <div className={`${showGrid ? 'grid grid-cols-2 gap-4' : 'space-y-4'} max-w-2xl`}>
              <Input
                variant="filled"
                state="error"
                placeholder="Email address"
                leftIcon={<Icon name="file" size={16} />}
                defaultValue="invalid-email"
              />
              <Input
                variant="default"
                state="success"
                placeholder="Username"
                rightIcon={<Icon name="circle-check" size={16} className="text-success" />}
                defaultValue="valid_username"
              />
            </div>
          </section>
        </div>
      )}

      {/* Visual Testing Info */}
      <div className="mt-12 p-6 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-medium mb-2">Visual Testing Status</h3>
        <div className="space-y-2 text-sm">
          <p className="text-green-400">✅ Baseline screenshots captured (post-Tailwind)</p>
          <p className="text-green-400">✅ All variants and states implemented</p>
          <p className="text-yellow-400">⚠️ No pre-Tailwind baselines available for comparison</p>
          <p className="text-gray-400">
            Components were created directly with Tailwind CSS. Use this tool to verify visual
            consistency.
          </p>
        </div>
      </div>
    </div>
  );
};
