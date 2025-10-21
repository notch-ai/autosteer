import { cn } from '@/commons/utils';
import { logger } from '@/commons/utils/logger';
import { Card } from '@/components/ui/card';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DirectoryListingRequest,
  DirectoryListingResponse,
  WorkspaceSearchRequest,
  WorkspaceSearchResponse,
} from '@/types/ipc.types';
import React, { useEffect, useMemo, useRef, useState } from 'react';

interface FileMention {
  name: string;
  path: string;
  isDirectory: boolean;
  icon: string;
}

export interface FileMentionsProps {
  query?: string;
  onSelect: (file: FileMention) => void;
  onTabSelect?: (file: FileMention) => void;
  onClose: () => void;
  position?: {
    top?: number;
    bottom?: number;
    left: number;
    width?: number;
    maxHeight?: number;
  };
  className?: string;
  projectPath?: string | undefined;
}

export const FileMentions: React.FC<FileMentionsProps> = ({
  query = '',
  onSelect,
  onTabSelect,
  onClose,
  position,
  className,
  projectPath,
}) => {
  const [files, setFiles] = useState<FileMention[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [basePath, setBasePath] = useState<string>('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const loadFiles = async (path?: string, searchQuery?: string) => {
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
  };

  useEffect(() => {
    // Debounce search to avoid too many requests
    const timeoutId = setTimeout(
      () => {
        loadFiles(undefined, query);
      },
      query ? 200 : 0
    ); // No debounce for initial empty query

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const filteredFiles = useMemo(() => {
    return files;
  }, [files]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredFiles]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle events if this component is mounted and visible
      if (!pickerRef.current || !document.body.contains(pickerRef.current)) {
        console.log('[FileMentions] Ignoring event - picker not mounted or not in DOM');
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredFiles.length - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => (prev < filteredFiles.length - 1 ? prev + 1 : 0));
          break;
        case 'Tab':
          e.preventDefault();
          e.stopPropagation();
          if (filteredFiles[selectedIndex]) {
            const selected = filteredFiles[selectedIndex];
            if (selected.isDirectory) {
              const newPath = currentPath ? `${currentPath}/${selected.name}` : selected.name;
              setCurrentPath(newPath);
              loadFiles(selected.path);
              // Use onTabSelect if provided, otherwise fall back to onSelect
              if (onTabSelect) {
                onTabSelect({
                  ...selected,
                  name: newPath + '/',
                  isDirectory: true,
                });
              } else {
                onSelect({
                  ...selected,
                  name: newPath + '/',
                  isDirectory: true,
                });
              }
            } else {
              const filePath = currentPath ? `${currentPath}/${selected.name}` : selected.name;
              // Use onTabSelect if provided, otherwise fall back to onSelect
              if (onTabSelect) {
                onTabSelect({
                  ...selected,
                  name: filePath,
                  isDirectory: false,
                });
              } else {
                onSelect({
                  ...selected,
                  name: filePath,
                  isDirectory: false,
                });
              }
            }
          }
          break;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          if (filteredFiles[selectedIndex]) {
            const selected = filteredFiles[selectedIndex];
            const fullPath = currentPath ? `${currentPath}/${selected.name}` : selected.name;
            onSelect({
              ...selected,
              name: fullPath,
              isDirectory: selected.isDirectory,
            });
          }
          break;
        case 'Backspace':
          if (currentPath && currentPath.includes('/')) {
            e.preventDefault();
            e.stopPropagation();
            const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
            setCurrentPath(parentPath);
            const parentFullPath = parentPath ? `${basePath}/${parentPath}` : basePath;
            loadFiles(parentFullPath);
            onSelect({
              name: parentPath ? parentPath + '/' : '',
              path: parentFullPath,
              isDirectory: true,
              icon: '',
            });
          }
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredFiles, selectedIndex, onSelect, onClose, currentPath, basePath, query]);

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
  }, [selectedIndex]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const calculatePosition = (): React.CSSProperties => {
    if (!position) return {};

    const styles: React.CSSProperties = {
      position: 'fixed',
      left: `${position.left}px`,
      width: position.width ? `${position.width}px` : '600px',
      maxWidth: 'calc(100vw - 32px)',
      zIndex: 50,
    };

    // Handle bottom vs top positioning
    if (position.bottom !== undefined) {
      if (position.maxHeight) {
        styles.maxHeight = `${position.maxHeight}px`;
      }

      // Position from bottom (already calculated in parent)
      styles.bottom = `${position.bottom}px`;
    } else if (position.top !== undefined) {
      styles.top = `${position.top}px`;

      if (position.maxHeight) {
        styles.maxHeight = `${position.maxHeight}px`;
      }
    }

    return styles;
  };

  const positionStyles = calculatePosition();

  if (isLoading) {
    return (
      <Card
        ref={pickerRef}
        className={cn('p-4 bg-background border-border', className)}
        style={positionStyles}
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce"></span>
          </div>
          <span className="text-sm text-muted-foreground">Loading files...</span>
        </div>
      </Card>
    );
  }

  if (filteredFiles.length === 0) {
    return (
      <Card
        ref={pickerRef}
        className={cn('p-2 bg-background border-border', className)}
        style={positionStyles}
      >
        <p className="text-sm text-muted-foreground text-center py-4">
          {query ? `No files matching "${query}"` : 'No files found'}
        </p>
      </Card>
    );
  }

  return (
    <Card
      ref={pickerRef}
      className={cn('p-0 overflow-hidden bg-background border-border w-full max-w-full', className)}
      style={positionStyles}
    >
      <Command className="border-0 bg-transparent w-full" loop={false} value="">
        <ScrollArea ref={scrollAreaRef} className="max-h-[300px] w-full">
          <CommandList className="bg-transparent !block w-full">
            <CommandGroup className="bg-transparent w-full">
              {filteredFiles.map((file, index) => (
                <CommandItem
                  key={file.path}
                  value={file.path}
                  data-index={index}
                  data-selected={index === selectedIndex}
                  className={cn(
                    'px-2 py-1 !gap-0 overflow-hidden !grid grid-cols-[1fr_auto]',
                    index === selectedIndex && 'bg-accent text-accent-foreground'
                  )}
                  onSelect={() => onSelect(file)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  title={file.name}
                >
                  <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                    @{file.name}
                  </span>
                  {file.isDirectory && <span className="text-sm text-muted-foreground">/</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </ScrollArea>
      </Command>
    </Card>
  );
};
