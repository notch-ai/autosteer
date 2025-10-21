import type { Meta, StoryObj } from '@storybook/react-vite';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion';

const meta: Meta<typeof Accordion> = {
  title: 'UI/Accordion',
  component: Accordion,
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
type Story = StoryObj<typeof Accordion>;

export const Default: Story = {
  render: () => (
    <div className="w-[400px]">
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Is it accessible?</AccordionTrigger>
          <AccordionContent>Yes. It adheres to the WAI-ARIA design pattern.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Is it styled?</AccordionTrigger>
          <AccordionContent>
            Yes. It comes with default styles that match the AutoSteer aesthetic.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger>Is it animated?</AccordionTrigger>
          <AccordionContent>
            Yes. It's animated by default, but you can disable it if you prefer.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

export const Multiple: Story = {
  render: () => (
    <div className="w-[400px]">
      <Accordion type="multiple" defaultValue={['item-1', 'item-3']}>
        <AccordionItem value="item-1">
          <AccordionTrigger>First Section</AccordionTrigger>
          <AccordionContent>
            This is the content of the first section. Multiple sections can be open at once.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Second Section</AccordionTrigger>
          <AccordionContent>This is the content of the second section.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger>Third Section</AccordionTrigger>
          <AccordionContent>
            This is the content of the third section. It's open by default along with the first.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-[400px]">
      <Accordion type="single" collapsible disabled>
        <AccordionItem value="item-1">
          <AccordionTrigger>This accordion is disabled</AccordionTrigger>
          <AccordionContent>You shouldn't be able to see this content.</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
};

export const ThemeComparison: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8">
      <div className="theme-day p-6 rounded-lg bg-background border w-[350px]">
        <h3 className="mb-4 font-semibold text-text">Day Theme</h3>
        <Accordion type="single" collapsible defaultValue="item-1">
          <AccordionItem value="item-1">
            <AccordionTrigger>Features</AccordionTrigger>
            <AccordionContent>Clean and bright design for daytime use.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Benefits</AccordionTrigger>
            <AccordionContent>Easy on the eyes during daylight hours.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
      <div className="theme-night p-6 rounded-lg bg-background border w-[350px]">
        <h3 className="mb-4 font-semibold text-text">Night Theme</h3>
        <Accordion type="single" collapsible defaultValue="item-1">
          <AccordionItem value="item-1">
            <AccordionTrigger>Features</AccordionTrigger>
            <AccordionContent>Dark and comfortable design for nighttime use.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Benefits</AccordionTrigger>
            <AccordionContent>Reduces eye strain in low-light conditions.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  ),
};
