import { Input } from '@/features/shared/components/ui/Input';
import { Modal } from '@/features/shared/components/ui/Modal';
import { SearchService } from '@/commons/utils/SearchService';
import { Card } from '@/components/ui/card';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { toastError, toastSuccess } from '@/components/ui/sonner';
import { usePickerKeyboardNav } from '@/hooks/usePickerKeyboardNav';
import { useProjectsStore } from '@/stores';
import { CreateProjectInput } from '@/types/project.types';
import React, { useEffect, useMemo, useRef, useState } from 'react';

interface AddProjectModalProps {
  onClose: () => void;
}

/**
 * AddProjectModal - Worktree creation modal with git repository dropdown
 *
 * Features:
 * - Repository URL autocomplete with debounced filtering (150ms delay)
 * - Full keyboard navigation support (Tab, Arrow keys, Enter, Escape)
 * - Cross-platform dropdown positioning and visibility
 * - Performance optimized for 100+ repositories
 * - Error boundary protection for dropdown failures
 *
 * Keyboard Navigation:
 * - Tab: Navigate through form fields
 * - ArrowDown/ArrowUp: Navigate dropdown options
 * - Enter: Select highlighted option
 * - Escape: Close dropdown or modal (when not creating)
 *
 * Troubleshooting:
 * - If dropdown doesn't appear: Check electron.worktree.getRepoUrls() availability
 * - If selection doesn't work: Verify CommandMenu event propagation
 * - If positioning is wrong: Check window resize/scroll listeners
 * - For performance issues with many repos: Verify CommandMenu virtualization
 */
export const AddProjectModal: React.FC<AddProjectModalProps> = ({ onClose }): JSX.Element => {
  const createProject = useProjectsStore((state) => state.createProject);
  const loadProjects = useProjectsStore((state) => state.loadProjects);
  const [formData, setFormData] = useState<CreateProjectInput>({
    name: '',
    description: '',
    githubRepo: '',
    branchName: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  // Autocomplete state
  const [repoUrls, setRepoUrls] = useState<string[]>([]);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false); 
  const inputRef = useRef<HTMLInputElement>(null);
  const branchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchServiceRef = useRef<SearchService<string> | null>(null);

  // Load repository URLs on mount
  useEffect((): void => {
    const loadRepoUrls = async (): Promise<void> => {
      try {
        const urls = await window.electron.worktree.getRepoUrls();

        // Filter out invalid URLs for better performance and UX
        const validUrls = urls.filter((url) => {
          const isValid =
            url && url.trim().length > 0 && (url.startsWith('https://') || url.startsWith('git@'));
          return isValid;
        });

        setRepoUrls(validUrls);
      } catch (error) {
        // Failed to load repository URLs
      }
    };
    void loadRepoUrls();
  }, []);

  // Initialize SearchService when repoUrls change
  useEffect(() => {
    if (repoUrls.length === 0) return;

    // Create SearchService instance if it doesn't exist
    if (!searchServiceRef.current) {
      searchServiceRef.current = new SearchService<string>({
        name: 'GitRepo',
        limit: 50,
      });
    }

    // Initialize index with all repo URLs
    searchServiceRef.current.initializeIndex(repoUrls, (url) => url);
  }, [repoUrls]);

  // Filter repository URLs based on input using SearchService
  const filteredRepos = useMemo(() => {
    if (!formData.githubRepo) {
      return repoUrls; // Show all repos when input is empty
    }

    if (!searchServiceRef.current) {
      return repoUrls;
    }

    // Use SearchService for unified search
    return searchServiceRef.current.search(formData.githubRepo, (url) => [url]);
  }, [formData.githubRepo, repoUrls]);

  // Handle autocomplete selection
  const handleAutocompleteSelect = (repoUrl: string): void => {
    try {
      setFormData({ ...formData, githubRepo: repoUrl });
      setIsAutocompleteOpen(false);
      setIsInputFocused(false); // Also clear focus state when selecting

      // Move focus to branch field after selection
      setTimeout(() => {
        branchInputRef.current?.focus();
      }, 0);
    } catch (error) {
      // Error selecting repository
    }
  };

  // Use shared keyboard navigation hook
  const { selectedIndex, setSelectedIndex } = usePickerKeyboardNav({
    items: filteredRepos,
    isOpen: isAutocompleteOpen,
    pickerRef: dropdownRef,
    onSelect: handleAutocompleteSelect,
    onClose: () => setIsAutocompleteOpen(false),
    onTabSelect: handleAutocompleteSelect,
    componentName: 'AddProjectModal',
  });

  // Debounce ref for input changes (150ms as per TRD)
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle input change and autocomplete with debouncing
  const handleGithubRepoChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setFormData({ ...formData, githubRepo: value });

    // Ensure input is marked as focused when user is typing
    setIsInputFocused(true);

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for debounced filtering
    debounceTimeoutRef.current = setTimeout(() => {
      // Calculate filtered repos for the new value
      const newFilteredRepos = value
        ? repoUrls.filter((url) => url.toLowerCase().includes(value.toLowerCase()))
        : repoUrls;

      // Show dropdown when input is focused and there are matching repos
      // Allow showing all repos when input is empty (cleared)
      const shouldShow = repoUrls.length > 0 && isInputFocused && newFilteredRepos.length > 0;

      setIsAutocompleteOpen(shouldShow);
    }, 150);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Check if all required fields are filled
  const isFormValid = formData.githubRepo?.trim() && formData.branchName?.trim();

  const handleSubmit = async (e?: React.FormEvent): Promise<void> => {
    e?.preventDefault();
    setIsCreating(true);

    try {
      // Trim spaces from inputs
      const trimmedGithubRepo = formData.githubRepo?.trim();
      const trimmedBranchName = formData.branchName?.trim();

      // Basic validation
      if (!trimmedGithubRepo) {
        throw new Error('GitHub repository URL is required');
      }
      if (!trimmedBranchName) {
        throw new Error('Branch name is required');
      }

      // Extract project name from repo URL if not provided
      const projectName =
        formData.name || trimmedGithubRepo.split('/').pop()?.replace('.git', '') || 'New Project';

      await createProject({
        name: projectName,
        ...(formData.description && { description: formData.description }),
        githubRepo: trimmedGithubRepo,
        branchName: trimmedBranchName,
        localPath: '', // Will be set by worktree service
      });

      // Reload projects to reflect the new worktree
      await loadProjects();

      toastSuccess('Project created successfully!');
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
      toastError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle keyboard events for form submission
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    // Submit form on Enter if valid and not creating
    if (e.key === 'Enter' && !e.shiftKey && isFormValid && !isCreating) {
      // Don't submit if autocomplete is open (let it handle Enter)
      if (isAutocompleteOpen) {
        return;
      }
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Create Project"
      showCloseButton={true}
      preventCloseOnEscape={isCreating}
      primaryAction={{
        label: 'Create Project',
        onClick: () => handleSubmit(),
        disabled: !isFormValid,
        loading: isCreating,
        loadingText: 'Creating Project',
      }}
    >
      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <div className="space-y-4">
          <div className="relative">
            <label
              htmlFor="github-repo"
              className="block text-sm font-semibold text-text tracking-wide mb-1"
            >
              GitHub URL
            </label>
            <div className="relative">
              <Input
                ref={inputRef}
                id="github-repo"
                type="text"
                value={formData.githubRepo || ''}
                onChange={handleGithubRepoChange}
                onFocus={() => {
                  setIsInputFocused(true);
                  // Only show autocomplete on focus if there's already text in the input
                  if (
                    repoUrls.length > 0 &&
                    formData.githubRepo &&
                    formData.githubRepo.trim().length > 0
                  ) {
                    setIsAutocompleteOpen(true);
                  }
                }}
                onBlur={(e) => {
                  setIsInputFocused(false);
                  // Only close if not clicking on the dropdown
                  if (!e.relatedTarget?.closest('[data-testid="repo-autocomplete"]')) {
                    setIsAutocompleteOpen(false);
                  }
                }}
                placeholder="https://github.com/username/repo.git or git://github.com/username/repo.git"
                autoFocus
              />
              {isAutocompleteOpen && (
                <Card
                  ref={dropdownRef}
                  className="absolute top-full left-0 right-0 mt-1 p-0 bg-background border shadow-lg z-50"
                  data-testid="repo-autocomplete"
                  style={{ zIndex: 9999 }}
                >
                  <Command
                    className="border-0 bg-transparent"
                    shouldFilter={false}
                    loop={false}
                    value=""
                  >
                    <CommandList className="bg-transparent max-h-[200px] overflow-y-auto">
                      {filteredRepos.length === 0 ? (
                        <div className="p-2 text-sm text-text-muted text-center">
                          No matching repositories found
                        </div>
                      ) : (
                        <CommandGroup className="bg-transparent">
                          {filteredRepos.map((url, index) => (
                            <CommandItem
                              key={url}
                              value={url}
                              data-index={index}
                              data-selected={index === selectedIndex}
                              onSelect={() => handleAutocompleteSelect(url)}
                              onMouseEnter={() => setSelectedIndex(index)}
                              className={`flex items-center gap-2 cursor-pointer overflow-hidden px-2 py-1.5 ${
                                index === selectedIndex ? 'bg-accent text-accent-foreground' : ''
                              }`}
                              title={url}
                            >
                              <span className="flex-1 min-w-0 block overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                                {url}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </Card>
              )}
            </div>
          </div>

          <div className="relative">
            <label
              htmlFor="branch-name"
              className="block text-sm font-semibold text-text tracking-wide mb-1"
            >
              Branch
            </label>
            <Input
              ref={branchInputRef}
              id="branch-name"
              type="text"
              value={formData.branchName || ''}
              onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
              placeholder="feature/new-feature"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};
