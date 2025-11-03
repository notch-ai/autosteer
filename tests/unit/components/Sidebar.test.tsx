import React from 'react';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '@/features/shared/components/layout/Sidebar';
import { useCoreStore } from '@/stores';
import '@testing-library/jest-dom';

// Mock the store
jest.mock('@/stores', () => ({
  useCoreStore: jest.fn(),
}));

// Mock the ProjectList component
jest.mock('@/renderer/features/shared/components/projects/ProjectList', () => ({
  ProjectList: () => <div data-testid="project-list">Project List</div>,
}));

// Mock the toggle components
jest.mock('@/components/features/DevModeToggle', () => ({
  DevModeToggle: () => <div data-testid="dev-mode-toggle">Dev Mode Toggle</div>,
}));

jest.mock('@/components/features/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>,
}));

describe('Sidebar', () => {
  const mockLoadProjects = jest.fn();
  const mockHasActiveTasks = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useCoreStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        loadProjects: mockLoadProjects,
        hasActiveTasks: mockHasActiveTasks,
      };
      return selector(state);
    });
  });

  describe('Task Indicator', () => {
    it('should show gray indicator when no tasks are active', () => {
      mockHasActiveTasks.mockReturnValue(false);

      render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />);

      const indicator = screen.getByLabelText('No active tasks');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass('task-indicator--idle');
      expect(indicator).toHaveClass('bg-gray-400');
      expect(indicator).not.toHaveClass('task-indicator--active');
    });

    it('should show green pulsing indicator when tasks are active', () => {
      mockHasActiveTasks.mockReturnValue(true);

      render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />);

      const indicator = screen.getByLabelText('Tasks running');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass('task-indicator--active');
      expect(indicator).toHaveClass('bg-green-500');
      expect(indicator).not.toHaveClass('task-indicator--idle');
    });

    it('should update indicator when task state changes', () => {
      mockHasActiveTasks.mockReturnValue(false);

      const { rerender } = render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />);

      let indicator = screen.getByLabelText('No active tasks');
      expect(indicator).toHaveClass('task-indicator--idle');

      // Update mock to return active tasks
      mockHasActiveTasks.mockReturnValue(true);

      rerender(<Sidebar collapsed={false} onToggleCollapse={() => {}} />);

      indicator = screen.getByLabelText('Tasks running');
      expect(indicator).toHaveClass('task-indicator--active');
    });

    it('should not show task indicator when sidebar is collapsed', () => {
      mockHasActiveTasks.mockReturnValue(true);

      render(<Sidebar collapsed={true} onToggleCollapse={() => {}} />);

      const indicator = screen.queryByLabelText('Tasks running');
      expect(indicator).not.toBeInTheDocument();
    });
  });

  describe('Sidebar functionality', () => {
    it('should call loadProjects on mount', () => {
      render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />);

      expect(mockLoadProjects).toHaveBeenCalledTimes(1);
    });

    it('should render all control buttons when not collapsed', () => {
      render(
        <Sidebar
          collapsed={false}
          onToggleCollapse={() => {}}
          onOpenLLMSettings={() => {}}
          onOpenKeyboardShortcuts={() => {}}
          onLogout={() => {}}
        />
      );

      expect(screen.getByTitle('LLM Settings')).toBeInTheDocument();
      expect(screen.getByTitle('Keyboard Shortcuts (⌘/)')).toBeInTheDocument();
      expect(screen.getByTitle('Sign Out')).toBeInTheDocument();
    });

    it('should not render logout button when onLogout is not provided', () => {
      render(<Sidebar collapsed={false} onToggleCollapse={() => {}} />);

      const logoutButton = screen.queryByTitle('Sign Out');
      expect(logoutButton).not.toBeInTheDocument();
    });
  });
});
