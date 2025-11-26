import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PermissionModeSelector } from '@/features/shared/components/agent/PermissionModeSelector';
import { PermissionMode } from '@/types/permission.types';

describe('PermissionModeSelector', () => {
  describe('Rendering', () => {
    it('should render button with current mode icon', () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="edit" onChange={handleChange} />);
      const button = screen.getByRole('button', { name: /permission: edit/i });
      expect(button).toBeInTheDocument();
    });

    it('should display plan mode icon when mode is plan', () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="plan" onChange={handleChange} />);
      const button = screen.getByRole('button', { name: /permission: plan/i });
      expect(button).toBeInTheDocument();
    });

    it('should display bypass mode icon when mode is bypass', () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="bypass" onChange={handleChange} />);
      const button = screen.getByRole('button', { name: /permission: bypass/i });
      expect(button).toBeInTheDocument();
    });

    it('should default to edit mode when mode is not found', () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode={'invalid' as PermissionMode} onChange={handleChange} />);
      const button = screen.getByRole('button', { name: /permission: edit/i });
      expect(button).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="edit" onChange={handleChange} disabled />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should not be disabled when disabled prop is false', () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="edit" onChange={handleChange} disabled={false} />);
      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });

    it('should apply custom className', () => {
      const handleChange = vi.fn();
      render(
        <PermissionModeSelector mode="edit" onChange={handleChange} className="custom-class" />
      );
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('Popover Interaction', () => {
    it('should open popover when button is clicked', async () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="edit" onChange={handleChange} />);

      const button = screen.getByRole('button', { name: /permission: edit/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Plan')).toBeInTheDocument();
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Bypass')).toBeInTheDocument();
      });
    });

    it('should display all three permission modes in popover', async () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="edit" onChange={handleChange} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Plan')).toBeInTheDocument();
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Bypass')).toBeInTheDocument();
      });
    });

    it('should highlight current mode in popover', async () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="edit" onChange={handleChange} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        const editButton = screen.getByRole('button', { name: /edit/i });
        expect(editButton).toHaveClass('bg-card-active');
        expect(editButton).toHaveClass('text-primary');
      });
    });

    it('should not highlight non-active modes', async () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="edit" onChange={handleChange} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        const planButton = screen.getByRole('button', { name: /plan/i });
        expect(planButton).not.toHaveClass('bg-card-active');
      });
    });
  });

  describe('Mode Selection', () => {
    it('should call onChange with plan mode when plan is selected', async () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="edit" onChange={handleChange} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        const planButton = screen.getByRole('button', { name: /plan/i });
        fireEvent.click(planButton);
      });

      expect(handleChange).toHaveBeenCalledWith('plan');
      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('should call onChange with edit mode when edit is selected', async () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="plan" onChange={handleChange} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        const editButton = screen.getByRole('button', { name: /edit/i });
        fireEvent.click(editButton);
      });

      expect(handleChange).toHaveBeenCalledWith('edit');
      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('should call onChange with bypass mode when bypass is selected', async () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="edit" onChange={handleChange} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        const bypassButton = screen.getByRole('button', { name: /bypass/i });
        fireEvent.click(bypassButton);
      });

      expect(handleChange).toHaveBeenCalledWith('bypass');
      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('should close popover after mode selection', async () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="edit" onChange={handleChange} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Plan')).toBeInTheDocument();
      });

      const planButton = screen.getByRole('button', { name: /plan/i });
      fireEvent.click(planButton);

      await waitFor(() => {
        expect(screen.queryByText('Plan')).not.toBeInTheDocument();
      });
    });

    it('should not call onChange when disabled', async () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="edit" onChange={handleChange} disabled />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.queryByText('Plan')).not.toBeInTheDocument();
      });

      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have correct title attribute', () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="edit" onChange={handleChange} />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Permission: Edit');
    });

    it('should update title when mode changes', () => {
      const handleChange = vi.fn();
      const { rerender } = render(<PermissionModeSelector mode="edit" onChange={handleChange} />);

      let button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Permission: Edit');

      rerender(<PermissionModeSelector mode="plan" onChange={handleChange} />);

      button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Permission: Plan');
    });

    it('should be keyboard accessible', async () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="edit" onChange={handleChange} />);

      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Plan')).toBeInTheDocument();
      });
    });
  });

  describe('Styling', () => {
    it('should have icon-secondary variant', () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="edit" onChange={handleChange} />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-variant', 'icon-secondary');
    });

    it('should have icon size', () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="edit" onChange={handleChange} />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-size', 'icon');
    });

    it('should apply correct popover styles', async () => {
      const handleChange = vi.fn();
      render(<PermissionModeSelector mode="edit" onChange={handleChange} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        const popover = screen.getByText('Plan').closest('[role="dialog"]');
        expect(popover).toHaveClass('bg-background');
        expect(popover).toHaveClass('border');
        expect(popover).toHaveClass('border-border');
      });
    });
  });
});
