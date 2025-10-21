# Git Diff Mock Data

Mock data for git changes to help with UX development and testing.

## Available Mock Data

### Git Stats (File List)
- ✅ **New file** - `src/features/new-feature.ts` (45 additions)
- ✅ **Deleted file** - `src/legacy/old-component.tsx` (78 deletions)
- ✅ **Modified file** - `src/components/UserProfile.tsx` (12 additions, 8 deletions)
- ✅ **Renamed file** - `src/utils/helpers.ts` (5 additions, 3 deletions)
- ✅ **Merge conflict** - `src/config/settings.json` (15 additions, 10 deletions)
- ✅ **Binary file** - `assets/logo.png` (binary)
- ✅ **Staged file** - `README.md` (3 additions, 1 deletion)

### File Diff Details
- `mockNewFileDiff` - Complete new file with imports and component
- `mockDeletedFileDiff` - Deleted component file
- `mockModifiedFileDiff` - File with additions and deletions
- `mockRenamedFileDiff` - File renamed with changes
- `mockConflictFileDiff` - File with merge conflict markers
- `mockBinaryFileDiff` - Binary file (no diff content)
- `mockLargeFileDiff` - Large file with 75+ changes

## Usage

### Option 1: Replace IPC Call (Development Mode)

In `GitDiffStats.tsx`, add mock data switch:

```typescript
import { mockGitStats, mockFileDiffs } from '@/mocks/gitDiffMockData';

// Add at top of component
const USE_MOCK_DATA = process.env.NODE_ENV === 'development'; // Toggle for dev

// In fetchGitStats:
if (USE_MOCK_DATA) {
  setStats(mockGitStats);
  return;
}

// In handleFileClick:
if (USE_MOCK_DATA) {
  const mockDiff = mockFileDiffs.get(file);
  setFileDiff(mockDiff ? [mockDiff] : []);
  return;
}
```

### Option 2: Storybook Stories

```typescript
import { mockGitStats, mockFileDiffs } from '@/mocks/gitDiffMockData';

export const WithMockData = {
  render: () => <GitDiffStats />,
  parameters: {
    mockData: {
      stats: mockGitStats,
      diffs: mockFileDiffs,
    },
  },
};
```

### Option 3: Jest Tests

```typescript
import { mockModifiedFileDiff, mockConflictFileDiff } from '@/mocks/gitDiffMockData';

it('renders modified file diff', () => {
  render(<GitDiffViewer files={[mockModifiedFileDiff]} />);
  // assertions
});

it('highlights merge conflicts', () => {
  render(<GitDiffViewer files={[mockConflictFileDiff]} />);
  // assertions
});
```

## Additional Use Cases to Consider

### Currently Covered ✅
1. New files (additions)
2. Deleted files (removals)
3. Modified files (updates)
4. Renamed files
5. Merge conflicts
6. Binary files
7. Large files with many changes

### Not Yet Covered ⚠️
1. **Whitespace-only changes** - Formatting/linting changes
2. **Permission changes** - `chmod +x` on scripts
3. **Submodule updates** - Git submodule pointer changes
4. **Symlink changes** - Symbolic link modifications
5. **Very long lines** - Testing horizontal scroll
6. **Unicode/Emoji** - Special characters in diffs
7. **Mixed line endings** - CRLF vs LF conflicts
8. **Empty files** - 0-byte files
9. **Partial staging** - Mix of staged/unstaged changes
10. **3-way merge** - Conflicts with base ancestor

## Mock Data Structure

All mock data follows the `FileDiff` interface from `@/types/git-diff.types`:

```typescript
interface FileDiff {
  from: string;           // Source file path
  to: string;             // Destination file path
  hunks: DiffHunk[];      // Change blocks
  additions: number;      // Lines added
  deletions: number;      // Lines deleted
  isNew: boolean;         // New file flag
  isDeleted: boolean;     // Deleted file flag
  isRenamed: boolean;     // Renamed file flag
  hasConflicts: boolean;  // Merge conflict flag
}
```
