import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Label } from './label';

const meta: Meta<typeof Select> = {
  title: 'UI/Select',
  component: Select,
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
    const [value, setValue] = React.useState('');

    return (
      <div className="space-y-2">
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select a fruit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
            <SelectItem value="blueberry">Blueberry</SelectItem>
            <SelectItem value="grapes">Grapes</SelectItem>
            <SelectItem value="pineapple">Pineapple</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Automatically shows {value ? 'white' : 'gray'} background
        </p>
      </div>
    );
  },
};

// Multiple Selects showing state changes
export const StateComparison: Story = {
  render: () => {
    const [value1, setValue1] = React.useState('');
    const [value2, setValue2] = React.useState('apple');

    return (
      <div className="flex flex-col gap-4 w-64">
        <div>
          <Label>No selection (gray background)</Label>
          <Select value={value1} onValueChange={setValue1}>
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">Option 1</SelectItem>
              <SelectItem value="option2">Option 2</SelectItem>
              <SelectItem value="option3">Option 3</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>With selection (white background)</Label>
          <Select value={value2} onValueChange={setValue2}>
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apple">Apple</SelectItem>
              <SelectItem value="banana">Banana</SelectItem>
              <SelectItem value="orange">Orange</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Disabled state</Label>
          <Select disabled>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Disabled select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">Option 1</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  },
};

// Form Example
export const FormExample: Story = {
  render: () => {
    const [country, setCountry] = React.useState('');
    const [city, setCity] = React.useState('');

    return (
      <form className="w-80 space-y-4">
        <div>
          <Label htmlFor="country">Country</Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger id="country">
              <SelectValue placeholder="Select your country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="us">United States</SelectItem>
              <SelectItem value="uk">United Kingdom</SelectItem>
              <SelectItem value="ca">Canada</SelectItem>
              <SelectItem value="au">Australia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="city">City</Label>
          <Select value={city} onValueChange={setCity} disabled={!country}>
            <SelectTrigger id="city">
              <SelectValue placeholder={country ? 'Select your city' : 'Select country first'} />
            </SelectTrigger>
            <SelectContent>
              {country === 'us' && (
                <>
                  <SelectItem value="ny">New York</SelectItem>
                  <SelectItem value="la">Los Angeles</SelectItem>
                  <SelectItem value="sf">San Francisco</SelectItem>
                </>
              )}
              {country === 'uk' && (
                <>
                  <SelectItem value="london">London</SelectItem>
                  <SelectItem value="manchester">Manchester</SelectItem>
                  <SelectItem value="birmingham">Birmingham</SelectItem>
                </>
              )}
              {country === 'ca' && (
                <>
                  <SelectItem value="toronto">Toronto</SelectItem>
                  <SelectItem value="vancouver">Vancouver</SelectItem>
                  <SelectItem value="montreal">Montreal</SelectItem>
                </>
              )}
              {country === 'au' && (
                <>
                  <SelectItem value="sydney">Sydney</SelectItem>
                  <SelectItem value="melbourne">Melbourne</SelectItem>
                  <SelectItem value="brisbane">Brisbane</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      </form>
    );
  },
};

// Theme Comparison
export const ThemeComparison: Story = {
  render: () => {
    const [dayValue, setDayValue] = React.useState('');
    const [nightValue, setNightValue] = React.useState('');

    return (
      <div className="grid grid-cols-2 gap-8">
        <div className="theme-day p-6 rounded-lg bg-background border">
          <h3 className="mb-4 font-semibold text-foreground">Day Theme</h3>
          <Select value={dayValue} onValueChange={setDayValue}>
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">Option 1</SelectItem>
              <SelectItem value="option2">Option 2</SelectItem>
              <SelectItem value="option3">Option 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="theme-night p-6 rounded-lg bg-background border">
          <h3 className="mb-4 font-semibold text-foreground">Night Theme</h3>
          <Select value={nightValue} onValueChange={setNightValue}>
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">Option 1</SelectItem>
              <SelectItem value="option2">Option 2</SelectItem>
              <SelectItem value="option3">Option 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  },
};
