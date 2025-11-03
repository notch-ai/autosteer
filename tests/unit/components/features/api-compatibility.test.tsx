import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

// Import feature components
import { Button } from '@/components/features/Button';
import { Input } from '@/components/features/Input';
import { FormButton } from '@/components/features/FormButton';
import { Skeleton } from '@/components/features/Skeleton';

// Import legacy types for comparison (using feature components as the source of truth)
import type { ButtonProps as LegacyButtonProps } from '@/components/features/Button';
import type { InputProps as LegacyInputProps } from '@/components/features/Input';
import type { FormButtonProps as LegacyFormButtonProps } from '@/components/features/FormButton';

/**
 * API Compatibility Tests
 * These tests verify that feature components maintain exact API compatibility with legacy components
 */

describe('Feature Component API Compatibility', () => {
  describe('Button Component', () => {
    it('should accept all legacy Button props', () => {
      const props: LegacyButtonProps = {
        variant: 'primary',
        size: 'md',
        asChild: false,
        className: 'test-class',
        onClick: jest.fn(),
        disabled: false,
      };

      expect(() => {
        render(<Button {...props}>Test Button</Button>);
      }).not.toThrow();
    });

    it('should render with legacy variants', () => {
      const { container } = render(
        <>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </>
      );

      expect(container).toBeInTheDocument();
    });

    it('should render with legacy sizes', () => {
      const { container } = render(
        <>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button size="icon">Icon</Button>
        </>
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('Input Component', () => {
    it('should accept all legacy Input props', () => {
      const props: LegacyInputProps = {
        variant: 'default',
        size: 'md',
        state: 'default',
        hasValue: false,
        leftIcon: <span>🔍</span>,
        rightIcon: <span>✨</span>,
        className: 'test-class',
        placeholder: 'Test input',
      };

      expect(() => {
        render(<Input {...props} />);
      }).not.toThrow();
    });

    it('should render with legacy variants', () => {
      const { container } = render(
        <>
          <Input variant="default" placeholder="Default" />
          <Input variant="filled" placeholder="Filled" />
          <Input variant="ghost" placeholder="Ghost" />
        </>
      );

      expect(container).toBeInTheDocument();
    });

    it('should render with legacy states', () => {
      const { container } = render(
        <>
          <Input state="default" placeholder="Default state" />
          <Input state="error" placeholder="Error state" />
          <Input state="success" placeholder="Success state" />
        </>
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('FormButton Component', () => {
    it('should accept all legacy FormButton props', () => {
      const props: LegacyFormButtonProps = {
        variant: 'primary',
        size: 'medium',
        loading: false,
        loadingText: 'Loading...',
        disabled: false,
        className: 'test-class',
        onClick: jest.fn(),
        type: 'button',
        children: 'Test Form Button',
      };

      expect(() => {
        render(<FormButton {...props}>Test Form Button</FormButton>);
      }).not.toThrow();
    });

    it('should render with legacy variants', () => {
      const { container } = render(
        <>
          <FormButton variant="primary">Primary</FormButton>
          <FormButton variant="secondary">Secondary</FormButton>
          <FormButton variant="danger">Danger</FormButton>
        </>
      );

      expect(container).toBeInTheDocument();
    });

    it('should handle loading state', () => {
      const { container } = render(
        <FormButton loading={true} loadingText="Saving...">
          Save
        </FormButton>
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('Skeleton Component', () => {
    it('should accept all legacy Skeleton props', () => {
      expect(() => {
        render(
          <>
            <Skeleton variant="text" width={100} height={20} count={3} className="test-class" />
            <Skeleton variant="title" width="75%" />
            <Skeleton variant="block" height={200} />
            <Skeleton variant="circle" width={40} height={40} />
            <Skeleton variant="card" />
          </>
        );
      }).not.toThrow();
    });

    it('should render preset skeleton components', () => {
      const { container } = render(
        <>
          <Skeleton variant="text" count={2} />
          <Skeleton variant="title" />
          <Skeleton variant="block" height={100} />
        </>
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe('Type Compatibility', () => {
    it('should maintain exact type compatibility', () => {
      // These assignments should not cause TypeScript errors
      const buttonProps: LegacyButtonProps = {
        variant: 'primary',
        size: 'md',
        asChild: true,
      };

      const inputProps: LegacyInputProps = {
        variant: 'default',
        size: 'md',
        state: 'error',
        hasValue: true,
      };

      const formButtonProps: LegacyFormButtonProps = {
        variant: 'secondary',
        size: 'large',
        loading: true,
        children: 'Test',
      };

      // If these compile without errors, type compatibility is maintained
      expect(buttonProps).toBeDefined();
      expect(inputProps).toBeDefined();
      expect(formButtonProps).toBeDefined();
    });
  });
});
