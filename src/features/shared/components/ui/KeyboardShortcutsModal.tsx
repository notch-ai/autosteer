import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/features/shared/components/ui/Icon';
import {
  SHORTCUT_GROUPS,
  formatShortcutKeys,
  searchShortcuts,
  getTotalShortcutCount,
  type Shortcut,
  type ShortcutGroup,
} from '@/commons/utils/shortcutsRegistry';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Individual shortcut item display
 */
const ShortcutItem: React.FC<{ shortcut: Shortcut }> = ({ shortcut }) => {
  const formattedKeys = formatShortcutKeys(shortcut.keys);

  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-surface-hover rounded-md transition-colors">
      <div className="flex-1">
        <span className="text-sm text-text">{shortcut.description}</span>
        {shortcut.when && <span className="text-sm text-text-muted ml-2">• {shortcut.when}</span>}
      </div>
      <div className="flex items-center gap-2">
        {formattedKeys.map((key, index) => (
          <React.Fragment key={`${shortcut.id}-${index}`}>
            {index > 0 && <span className="text-text-muted text-sm">or</span>}
            <Badge variant="outline" className="font-kbd text-sm">
              {key}
            </Badge>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

/**
 * Shortcut group card display
 */
const ShortcutGroupCard: React.FC<{ group: ShortcutGroup }> = ({ group }) => {
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-text tracking-wide">
          {group.name}
        </CardTitle>
        {group.description && (
          <CardDescription className="text-sm">{group.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {group.shortcuts.map((shortcut) => (
            <ShortcutItem key={shortcut.id} shortcut={shortcut} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Search and filter controls section
 */
const SearchAndFilters: React.FC<{
  searchQuery: string;
  selectedCategory: string | null;
  onSearchChange: (query: string) => void;
  onCategorySelect: (categoryId: string) => void;
  onResetFilters: () => void;
}> = ({ searchQuery, selectedCategory, onSearchChange, onCategorySelect, onResetFilters }) => {
  return (
    <div className="space-y-3 mb-4">
      {/* Search Input */}
      <div className="relative">
        <Icon
          name="search"
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted"
        />
        <Input
          id="shortcuts-search"
          type="text"
          placeholder="Search shortcuts..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category Filter Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={selectedCategory === null && !searchQuery ? 'secondary' : 'outline'}
          className="cursor-pointer select-none"
          onClick={onResetFilters}
        >
          All Categories
        </Badge>
        {SHORTCUT_GROUPS.map((group) => (
          <Badge
            key={group.id}
            variant={selectedCategory === group.id ? 'secondary' : 'outline'}
            className="cursor-pointer select-none"
            onClick={() => onCategorySelect(group.id)}
          >
            {group.name}
          </Badge>
        ))}
      </div>
    </div>
  );
};

/**
 * Shortcuts display area with empty state
 */
const ShortcutsDisplay: React.FC<{
  groups: ShortcutGroup[];
  searchQuery: string;
}> = ({ groups, searchQuery }) => {
  return (
    <div className="flex-1 overflow-y-auto">
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-text-muted">
          <Icon name="search" className="h-8 w-8 mb-3 opacity-50" />
          <p className="text-sm">No shortcuts found</p>
          {searchQuery && <p className="text-sm mt-1">Try adjusting your search</p>}
        </div>
      ) : (
        <div className="grid gap-4 pb-4">
          {groups.map((group) => (
            <ShortcutGroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Modal footer with keyboard instructions
 */
const ModalFooter: React.FC = () => {
  return (
    <div className="pt-3 border-t border-border flex items-center justify-between">
      <div className="text-sm text-text-muted">
        Press{' '}
        <Badge variant="outline" className="text-sm mx-1 py-0 px-1">
          Esc
        </Badge>{' '}
        to close
      </div>
      <div className="text-sm text-text-muted">
        Press{' '}
        <Badge variant="outline" className="text-sm mx-1 py-0 px-1">
          ⌘F
        </Badge>{' '}
        to search
      </div>
    </div>
  );
};

/**
 * Main keyboard shortcuts modal
 */
export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Get filtered groups based on search
  const filteredGroups = useMemo(() => {
    if (searchQuery) {
      return searchShortcuts(searchQuery);
    }
    if (selectedCategory) {
      return SHORTCUT_GROUPS.filter((g) => g.id === selectedCategory);
    }
    return SHORTCUT_GROUPS;
  }, [searchQuery, selectedCategory]);

  // Get total shortcuts count
  const totalShortcuts = useMemo(() => {
    if (searchQuery || selectedCategory) {
      return filteredGroups.reduce((sum, g) => sum + g.shortcuts.length, 0);
    }
    return getTotalShortcutCount();
  }, [filteredGroups, searchQuery, selectedCategory]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return () => {}; // Return empty cleanup function

    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }

      // Focus search on Cmd/Ctrl+F
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('shortcuts-search');
        searchInput?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-focus search when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedCategory(null);
      setTimeout(() => {
        const searchInput = document.getElementById('shortcuts-search');
        searchInput?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleCategoryClick = (categoryId: string) => {
    if (selectedCategory === categoryId) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(categoryId);
      setSearchQuery('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            {totalShortcuts} shortcuts available • Press{' '}
            <kbd className="text-sm px-1 py-0.5 bg-surface border border-border rounded">⌘/</kbd> to
            open anytime
          </DialogDescription>
        </DialogHeader>

        {/* Content area following design system standards: px-6 pt-0 pb-6 */}
        <div className="px-6 pt-0 pb-6 flex-1 flex flex-col overflow-hidden">
          <SearchAndFilters
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
            onSearchChange={(query) => {
              setSearchQuery(query);
              setSelectedCategory(null);
            }}
            onCategorySelect={handleCategoryClick}
            onResetFilters={() => {
              setSelectedCategory(null);
              setSearchQuery('');
            }}
          />

          <ShortcutsDisplay groups={filteredGroups} searchQuery={searchQuery} />

          <ModalFooter />
        </div>
      </DialogContent>
    </Dialog>
  );
};
