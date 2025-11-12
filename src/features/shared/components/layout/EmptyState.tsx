import { Button } from '@/components/ui/button';
import React from 'react';

interface EmptyStateProps {
  onCreateProject: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onCreateProject }) => {
  return (
    <main
      id="main-content-empty"
      data-component="MainContent"
      data-state="empty"
      className="h-full flex flex-col bg-background main-content-container"
    >
      <div
        id="center-panel-empty"
        data-panel="center-empty"
        className="h-full flex flex-col items-center justify-center center-panel"
      >
        <Button variant="brand" onClick={onCreateProject}>
          Create a project
        </Button>
      </div>
    </main>
  );
};
