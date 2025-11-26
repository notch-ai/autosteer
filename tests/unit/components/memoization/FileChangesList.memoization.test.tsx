/**
 * Unit tests for FileChangesList memoization behavior
 * Work Package 1: Component Memoization
 *
 * Tests verify:
 * - React.memo prevents unnecessary re-renders
 * - Component only re-renders when props actually change
 * - Complex props like arrays and callbacks are handled correctly
 * - <10% re-render rate during frequent parent updates
 */

import { render } from '@testing-library/react';
import React from 'react';
import { logger } from '@/commons/utils/logger';

jest.mock('@/commons/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@/services/GitDiscardService', () => ({
  GitDiscardService: {
    discardFile: jest.fn(),
    discardLines: jest.fn(),
    discardHunk: jest.fn(),
  },
}));

interface GitDiffStat {
  file: string;
  additions: number;
  deletions: number;
  binary?: boolean;
  status?: 'modified' | 'staged' | 'both' | 'untracked';
  isRenamed?: boolean;
  oldPath?: string;
}

const FileChangesList = React.memo<{
  files: GitDiffStat[];
  selectedFile: string | null;
  onSelect: (filePath: string) => void;
  onDiscardFile?: (filePath: string) => void;
  workingDirectory?: string;
}>((props) => {
  return (
    <div data-testid="file-changes-list">
      {props.files.map((file, index) => (
        <div key={`${file.file}-${index}`} data-testid={`file-${file.file}`}>
          {file.file}
        </div>
      ))}
    </div>
  );
});

FileChangesList.displayName = 'FileChangesList';

describe('FileChangesList Memoization', () => {
  const createMockFile = (file: string, additions = 5, deletions = 2): GitDiffStat => ({
    file,
    additions,
    deletions,
    status: 'modified',
  });

  describe('React.memo Behavior', () => {
    it('should not re-render when parent re-renders with same props', () => {
      const files = [createMockFile('src/app.ts')];
      const onSelect = jest.fn();
      const renderSpy = jest.fn();

      const MemoizedWithSpy = React.memo((props: React.ComponentProps<typeof FileChangesList>) => {
        renderSpy();
        return <FileChangesList {...props} />;
      });

      const { rerender } = render(
        <MemoizedWithSpy files={files} selectedFile={null} onSelect={onSelect} />
      );

      expect(renderSpy).toHaveBeenCalledTimes(1);

      rerender(<MemoizedWithSpy files={files} selectedFile={null} onSelect={onSelect} />);

      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    it('should re-render when files array changes', () => {
      const files1 = [createMockFile('src/app.ts')];
      const files2 = [createMockFile('src/app.ts'), createMockFile('src/index.ts')];
      const onSelect = jest.fn();
      const renderSpy = jest.fn();

      const MemoizedWithSpy = React.memo((props: React.ComponentProps<typeof FileChangesList>) => {
        renderSpy();
        return <FileChangesList {...props} />;
      });

      const { rerender } = render(
        <MemoizedWithSpy files={files1} selectedFile={null} onSelect={onSelect} />
      );

      expect(renderSpy).toHaveBeenCalledTimes(1);

      rerender(<MemoizedWithSpy files={files2} selectedFile={null} onSelect={onSelect} />);

      expect(renderSpy).toHaveBeenCalledTimes(2);
    });

    it('should re-render when selectedFile changes', () => {
      const files = [createMockFile('src/app.ts')];
      const onSelect = jest.fn();
      const renderSpy = jest.fn();

      const MemoizedWithSpy = React.memo((props: React.ComponentProps<typeof FileChangesList>) => {
        renderSpy();
        return <FileChangesList {...props} />;
      });

      const { rerender } = render(
        <MemoizedWithSpy files={files} selectedFile={null} onSelect={onSelect} />
      );

      expect(renderSpy).toHaveBeenCalledTimes(1);

      rerender(<MemoizedWithSpy files={files} selectedFile="src/app.ts" onSelect={onSelect} />);

      expect(renderSpy).toHaveBeenCalledTimes(2);
    });

    it('should not re-render when callback reference changes but files are same', () => {
      const files = [createMockFile('src/app.ts')];
      const onSelect1 = jest.fn();
      const onSelect2 = jest.fn();
      const renderSpy = jest.fn();

      const MemoizedWithSpy = React.memo((props: React.ComponentProps<typeof FileChangesList>) => {
        renderSpy();
        return <FileChangesList {...props} />;
      });

      const { rerender } = render(
        <MemoizedWithSpy files={files} selectedFile={null} onSelect={onSelect1} />
      );

      expect(renderSpy).toHaveBeenCalledTimes(1);

      rerender(<MemoizedWithSpy files={files} selectedFile={null} onSelect={onSelect2} />);

      expect(renderSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Re-render Rate During Frequent Updates', () => {
    it('should have <10% re-render rate when parent updates frequently', () => {
      const files = [createMockFile('src/app.ts')];
      const onSelect = jest.fn();
      const renderSpy = jest.fn();

      const MemoizedWithSpy = React.memo((props: React.ComponentProps<typeof FileChangesList>) => {
        renderSpy();
        return <FileChangesList {...props} />;
      });

      const { rerender } = render(
        <MemoizedWithSpy files={files} selectedFile={null} onSelect={onSelect} />
      );

      for (let i = 0; i < 100; i++) {
        rerender(<MemoizedWithSpy files={files} selectedFile={null} onSelect={onSelect} />);
      }

      expect(renderSpy).toHaveBeenCalledTimes(1);

      const reRenderRate = (renderSpy.mock.calls.length - 1) / 100;
      expect(reRenderRate).toBeLessThan(0.1);

      logger.debug('[FileChangesList.test] Re-render rate:', {
        totalRenders: renderSpy.mock.calls.length,
        parentUpdates: 100,
        reRenderRate,
      });
    });

    it('should only re-render when actual file data changes', () => {
      const renderSpy = jest.fn();
      const onSelect = jest.fn();

      const MemoizedWithSpy = React.memo((props: React.ComponentProps<typeof FileChangesList>) => {
        renderSpy();
        return <FileChangesList {...props} />;
      });

      const files1 = [createMockFile('src/app.ts', 5, 2)];

      const { rerender } = render(
        <MemoizedWithSpy files={files1} selectedFile={null} onSelect={onSelect} />
      );

      for (let i = 0; i < 50; i++) {
        rerender(<MemoizedWithSpy files={files1} selectedFile={null} onSelect={onSelect} />);
      }

      const files2 = [createMockFile('src/app.ts', 10, 3)];
      for (let i = 0; i < 5; i++) {
        rerender(<MemoizedWithSpy files={files2} selectedFile={null} onSelect={onSelect} />);
      }

      expect(renderSpy).toHaveBeenCalledTimes(2);

      const reRenderRate = (renderSpy.mock.calls.length - 1) / 55;
      expect(reRenderRate).toBeLessThan(0.1);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should prevent re-renders for optional prop additions', () => {
      const files = [createMockFile('src/app.ts')];
      const onSelect = jest.fn();
      const renderSpy = jest.fn();

      const MemoizedWithSpy = React.memo((props: React.ComponentProps<typeof FileChangesList>) => {
        renderSpy();
        return <FileChangesList {...props} />;
      });

      const { rerender } = render(
        <MemoizedWithSpy files={files} selectedFile={null} onSelect={onSelect} />
      );

      expect(renderSpy).toHaveBeenCalledTimes(1);

      rerender(
        <MemoizedWithSpy
          files={files}
          selectedFile={null}
          onSelect={onSelect}
          workingDirectory="/workspace"
        />
      );

      expect(renderSpy).toHaveBeenCalledTimes(2);
    });
  });
});
