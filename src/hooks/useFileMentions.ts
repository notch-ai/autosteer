import { logger } from '@/commons/utils/logger';
import { usePickerKeyboardNav } from '@/hooks/usePickerKeyboardNav';
import {
  DirectoryListingRequest,
  DirectoryListingResponse,
  WorkspaceSearchRequest,
  WorkspaceSearchResponse,
} from '@/types/ipc.types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface FileMention {
  name: string;
  path: string;
  isDirectory: boolean;
  icon: string;
}

export interface UseFileMentionsProps {
  query: string;
  isOpen: boolean;
  projectPath?: string;
  onSelect: (file: FileMention) => void;
  onClose: () => void;
  onTabSelect?: (file: FileMention) => void;
}

export interface UseFileMentionsReturn {
  files: FileMention[];
  filteredFiles: FileMention[];
  selectedIndex: number;
  setSelectedIndex: (index: number | ((prev: number) => number)) => void;
  isLoading: boolean;
  currentPath: string;
  pickerRef: React.RefObject<HTMLDivElement>;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  handleClickOutside: () => void;
}

/**
 * Business logic hook for FileMentions component
 *
 * Responsibilities:
 * - Load files from workspace via IPC
 * - Filter files based on search query
 * - Handle keyboard navigation (delegated to usePickerKeyboardNav with custom Backspace handler)
 * - Handle directory navigation
 * - Handle click outside to close
 * - Manage loading and current path state
 *
 * Architecture:
 * - Uses window.electron IPC for file operations
 * - Uses usePickerKeyboardNav for keyboard navigation
 * - Provides pickerRef and scrollAreaRef for DOM containment
 *
 * @see usePickerKeyboardNav for keyboard navigation pattern
 */
export const useFileMentions = ({
  query,
  isOpen,
  projectPath,
  onSelect,
  onClose,
  onTabSelect,
}: UseFileMentionsProps): UseFileMentionsReturn => {
  const [files, setFiles] = useState<FileMention[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [basePath, setBasePath] = useState<string>('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Load files from workspace
  const loadFiles = useCallback(
    async (path?: string, searchQuery?: string) => {
      setIsLoading(true);
      try {
        // Check if we're in Electron environment
        if (typeof window === 'undefined' || !window.electron) {
          setFiles([]);
          setIsLoading(false);
          return;
        }

        const electron = window.electron as any;
        if (!electron.worktree?.getCurrentDirectory || !electron.file?.listDirectory) {
          setFiles([]);
          setIsLoading(false);
          return;
        }

        let targetPath = path;
        if (!targetPath) {
          const cwd = await electron.worktree.getCurrentDirectory(projectPath);
          if (!cwd) {
            setFiles([]);
            return;
          }
          targetPath = cwd;
          setBasePath(cwd);
        }

        if (searchQuery && searchQuery.trim().length > 0 && electron.file?.searchWorkspace) {
          const searchRequest: WorkspaceSearchRequest = {
            query: searchQuery,
            workspacePath: basePath || targetPath!,
            maxResults: 100,
            includeHidden: true,
          };

          const searchResponse: WorkspaceSearchResponse =
            await electron.file.searchWorkspace(searchRequest);

          if (searchResponse?.entries) {
            const mentions = searchResponse.entries.map((entry) => ({
              name: entry.name,
              path: entry.path,
              isDirectory: entry.isDirectory,
              icon: '',
            }));
            setFiles(mentions);
          } else {
            setFiles([]);
          }
        } else {
          const request: DirectoryListingRequest = {
            path: targetPath!,
            includeHidden: false,
          };

          const response: DirectoryListingResponse = await electron.file.listDirectory(request);

          if (response?.entries) {
            const mentions = response.entries
              .filter((entry) => !entry.isDirectory)
              .map((entry) => ({
                name: entry.name,
                path: entry.path,
                isDirectory: entry.isDirectory,
                icon: '',
              }));
            setFiles(mentions);
          } else {
            setFiles([]);
          }
        }
      } catch (error) {
        logger.error('Failed to load files:', error);
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    },
    [projectPath, basePath]
  );

  // Load files on mount and query change
  useEffect(() => {
    if (!isOpen) return;

    // Debounce search to avoid too many requests
    const timeoutId = setTimeout(
      () => {
        loadFiles(undefined, query);
      },
      query ? 200 : 0
    ); // No debounce for initial empty query

    return () => clearTimeout(timeoutId);
  }, [query, isOpen, loadFiles]);

  // Filter files (currently no filtering, just return all)
  const filteredFiles = useMemo(() => {
    return files;
  }, [files]);

  // Wrap onSelect and onTabSelect to handle directory navigation
  const handleSelect = useCallback(
    (file: FileMention) => {
      const fullPath = currentPath ? `${currentPath}/${file.name}` : file.name;
      onSelect({
        ...file,
        name: fullPath,
        isDirectory: file.isDirectory,
      });
    },
    [currentPath, onSelect]
  );

  const handleTabSelect = useCallback(
    (file: FileMention) => {
      if (file.isDirectory) {
        const newPath = currentPath ? `${currentPath}/${file.name}` : file.name;
        setCurrentPath(newPath);
        loadFiles(file.path);
        if (onTabSelect) {
          onTabSelect({
            ...file,
            name: newPath + '/',
            isDirectory: true,
          });
        } else {
          onSelect({
            ...file,
            name: newPath + '/',
            isDirectory: true,
          });
        }
      } else {
        const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
        if (onTabSelect) {
          onTabSelect({
            ...file,
            name: filePath,
            isDirectory: false,
          });
        } else {
          onSelect({
            ...file,
            name: filePath,
            isDirectory: false,
          });
        }
      }
    },
    [currentPath, loadFiles, onSelect, onTabSelect]
  );

  // Keyboard navigation
  // Note: Backspace is NOT registered as an additional key to allow normal text editing
  const { selectedIndex, setSelectedIndex } = usePickerKeyboardNav({
    items: filteredFiles,
    isOpen,
    pickerRef,
    onSelect: handleSelect,
    onClose,
    ...(onTabSelect && { onTabSelect: handleTabSelect }),
    enableLogging: false,
    componentName: 'FileMentions',
  });

  // Auto-scroll to selected item
  useEffect(() => {
    if (scrollAreaRef.current && filteredFiles.length > 0) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      ) as HTMLElement;

      if (scrollContainer) {
        const selectedElement = scrollContainer.querySelector(
          `[data-index="${selectedIndex}"]`
        ) as HTMLElement;

        if (selectedElement) {
          selectedElement.scrollIntoView({
            block: 'nearest',
            behavior: 'smooth',
          });
        }
      }
    }
  }, [selectedIndex, filteredFiles.length]);

  // Handle clicks outside the picker
  const handleClickOutside = useCallback(() => {
    const handleClick = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    return handleClick;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClick = handleClickOutside();
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen, handleClickOutside]);

  return {
    files,
    filteredFiles,
    selectedIndex,
    setSelectedIndex,
    isLoading,
    currentPath,
    pickerRef,
    scrollAreaRef,
    handleClickOutside,
  };
};
