import { FileDiff } from '@/types/git-diff.types';
import { ChatMessage } from '@/entities/ChatMessage';

/**
 * Mock Git Diff Data for UX Development & Testing
 *
 * This file provides comprehensive mock data for all git change scenarios:
 * - New files (additions)
 * - Deleted files (removals)
 * - Modified files (updates)
 * - Renamed files
 * - Merge conflicts
 * - Binary files
 * - Large diffs
 * - Whitespace-only changes
 */

// Git Diff Stats Mock Data
export const mockGitStats = [
  // New file (addition)
  {
    file: 'src/features/new-feature.ts',
    additions: 45,
    deletions: 0,
    binary: false,
    status: 'untracked' as const,
  },
  // Deleted file (removal)
  {
    file: 'src/legacy/old-component.tsx',
    additions: 0,
    deletions: 78,
    binary: false,
    status: 'modified' as const,
  },
  // Modified file (update)
  {
    file: 'src/components/UserProfile.tsx',
    additions: 12,
    deletions: 8,
    binary: false,
    status: 'modified' as const,
  },
  // Renamed file
  {
    file: 'src/utils/helpers.ts',
    additions: 5,
    deletions: 3,
    binary: false,
    status: 'modified' as const,
  },
  // File with conflicts
  {
    file: 'src/config/settings.json',
    additions: 15,
    deletions: 10,
    binary: false,
    status: 'both' as const,
  },
  // Binary file
  {
    file: 'assets/logo.png',
    additions: 0,
    deletions: 0,
    binary: true,
    status: 'modified' as const,
  },
  // Staged file
  {
    file: 'README.md',
    additions: 3,
    deletions: 1,
    binary: false,
    status: 'staged' as const,
  },
  // Script file with mixed changes
  {
    file: 'scripts/deploy.sh',
    additions: 6,
    deletions: 2,
    binary: false,
    status: 'modified' as const,
  },
];

// File Diff Mock Data - New File (Addition)
export const mockNewFileDiff: FileDiff = {
  from: '/dev/null',
  to: 'src/features/new-feature.ts',
  hunks: [
    {
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: 45,
      changes: [
        {
          type: 'add',
          newLineNumber: 1,
          content: "import { useState, useEffect } from 'react';",
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 2,
          content: "import { logger } from '@/commons/utils/logger';",
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 3,
          content: '',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 4,
          content: 'interface FeatureProps {',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 5,
          content: '  userId: string;',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 6,
          content: '  onComplete: () => void;',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 7,
          content: '}',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 8,
          content: '',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 9,
          content:
            'export const NewFeature: React.FC<FeatureProps> = ({ userId, onComplete }) => {',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 10,
          content: '  const [loading, setLoading] = useState(false);',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 11,
          content: '',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 12,
          content: '  useEffect(() => {',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 13,
          content: "    logger.info('Feature initialized', { userId });",
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 14,
          content: '  }, [userId]);',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 15,
          content: '',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 16,
          content: '  return <div>New Feature Content</div>;',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 17,
          content: '};',
          isConflict: false,
        },
      ],
      hasConflicts: false,
    },
  ],
  additions: 45,
  deletions: 0,
  isNew: true,
  isDeleted: false,
  isRenamed: false,
  hasConflicts: false,
};

// File Diff Mock Data - Deleted File (Removal)
export const mockDeletedFileDiff: FileDiff = {
  from: 'src/legacy/old-component.tsx',
  to: '/dev/null',
  hunks: [
    {
      oldStart: 1,
      oldLines: 78,
      newStart: 0,
      newLines: 0,
      changes: [
        {
          type: 'del',
          oldLineNumber: 1,
          content: "import React from 'react';",
          isConflict: false,
        },
        {
          type: 'del',
          oldLineNumber: 2,
          content: "import { Button } from '@/components/ui/button';",
          isConflict: false,
        },
        {
          type: 'del',
          oldLineNumber: 3,
          content: '',
          isConflict: false,
        },
        {
          type: 'del',
          oldLineNumber: 4,
          content: '/** @deprecated This component is no longer used */',
          isConflict: false,
        },
        {
          type: 'del',
          oldLineNumber: 5,
          content: 'export const OldComponent: React.FC = () => {',
          isConflict: false,
        },
        {
          type: 'del',
          oldLineNumber: 6,
          content: '  return (',
          isConflict: false,
        },
        {
          type: 'del',
          oldLineNumber: 7,
          content: '    <div className="old-component">',
          isConflict: false,
        },
        {
          type: 'del',
          oldLineNumber: 8,
          content: '      <Button>Legacy Action</Button>',
          isConflict: false,
        },
        {
          type: 'del',
          oldLineNumber: 9,
          content: '    </div>',
          isConflict: false,
        },
        {
          type: 'del',
          oldLineNumber: 10,
          content: '  );',
          isConflict: false,
        },
        {
          type: 'del',
          oldLineNumber: 11,
          content: '};',
          isConflict: false,
        },
      ],
      hasConflicts: false,
    },
  ],
  additions: 0,
  deletions: 78,
  isNew: false,
  isDeleted: true,
  isRenamed: false,
  hasConflicts: false,
};

// File Diff Mock Data - Modified File (Update)
export const mockModifiedFileDiff: FileDiff = {
  from: 'src/components/UserProfile.tsx',
  to: 'src/components/UserProfile.tsx',
  hunks: [
    {
      oldStart: 12,
      oldLines: 10,
      newStart: 12,
      newLines: 14,
      changes: [
        {
          type: 'normal',
          oldLineNumber: 12,
          newLineNumber: 12,
          content: 'export const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 13,
          newLineNumber: 13,
          content: '  const [user, setUser] = useState<User | null>(null);',
          isConflict: false,
        },
        {
          type: 'del',
          oldLineNumber: 14,
          content: '  const [loading, setLoading] = useState(false);',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 14,
          content: '  const [loading, setLoading] = useState(true);',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 15,
          content: '  const [error, setError] = useState<string | null>(null);',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 15,
          newLineNumber: 16,
          content: '',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 16,
          newLineNumber: 17,
          content: '  useEffect(() => {',
          isConflict: false,
        },
        {
          type: 'del',
          oldLineNumber: 17,
          content: '    fetchUser(userId).then(setUser);',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 18,
          content: '    fetchUser(userId)',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 19,
          content: '      .then(setUser)',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 20,
          content: '      .catch((err) => setError(err.message))',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 21,
          content: '      .finally(() => setLoading(false));',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 18,
          newLineNumber: 22,
          content: '  }, [userId]);',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 19,
          newLineNumber: 23,
          content: '',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 24,
          content: '  if (error) return <div>Error: {error}</div>;',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 20,
          newLineNumber: 25,
          content: '  if (loading) return <div>Loading...</div>;',
          isConflict: false,
        },
      ],
      hasConflicts: false,
    },
  ],
  additions: 12,
  deletions: 8,
  isNew: false,
  isDeleted: false,
  isRenamed: false,
  hasConflicts: false,
};

// File Diff Mock Data - Renamed File
export const mockRenamedFileDiff: FileDiff = {
  from: 'src/utils/string-utils.ts',
  to: 'src/utils/helpers.ts',
  hunks: [
    {
      oldStart: 1,
      oldLines: 15,
      newStart: 1,
      newLines: 17,
      changes: [
        {
          type: 'del',
          oldLineNumber: 1,
          content: '// String utility functions',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 1,
          content: '// General helper functions',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 2,
          newLineNumber: 2,
          content: '',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 3,
          newLineNumber: 3,
          content: 'export function capitalize(str: string): string {',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 4,
          newLineNumber: 4,
          content: '  return str.charAt(0).toUpperCase() + str.slice(1);',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 5,
          newLineNumber: 5,
          content: '}',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 6,
          content: '',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 7,
          content: 'export function truncate(str: string, maxLength: number): string {',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 8,
          content: '  return str.length > maxLength ? str.slice(0, maxLength) + "..." : str;',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 9,
          content: '}',
          isConflict: false,
        },
      ],
      hasConflicts: false,
    },
  ],
  additions: 5,
  deletions: 3,
  isNew: false,
  isDeleted: false,
  isRenamed: true,
  hasConflicts: false,
};

// File Diff Mock Data - Merge Conflict
export const mockConflictFileDiff: FileDiff = {
  from: 'src/config/settings.json',
  to: 'src/config/settings.json',
  hunks: [
    {
      oldStart: 5,
      oldLines: 12,
      newStart: 5,
      newLines: 20,
      changes: [
        {
          type: 'normal',
          oldLineNumber: 5,
          newLineNumber: 5,
          content: '  "api": {',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 6,
          newLineNumber: 6,
          content: '    "baseUrl": "https://api.example.com",',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 7,
          content: '<<<<<<< HEAD',
          isConflict: true,
        },
        {
          type: 'add',
          newLineNumber: 8,
          content: '    "timeout": 5000,',
          isConflict: true,
        },
        {
          type: 'add',
          newLineNumber: 9,
          content: '    "retries": 3,',
          isConflict: true,
        },
        {
          type: 'add',
          newLineNumber: 10,
          content: '=======',
          isConflict: true,
        },
        {
          type: 'add',
          newLineNumber: 11,
          content: '    "timeout": 10000,',
          isConflict: true,
        },
        {
          type: 'add',
          newLineNumber: 12,
          content: '    "retries": 5,',
          isConflict: true,
        },
        {
          type: 'add',
          newLineNumber: 13,
          content: '    "cache": true,',
          isConflict: true,
        },
        {
          type: 'add',
          newLineNumber: 14,
          content: '>>>>>>> feature/api-improvements',
          isConflict: true,
        },
        {
          type: 'normal',
          oldLineNumber: 7,
          newLineNumber: 15,
          content: '    "headers": {',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 8,
          newLineNumber: 16,
          content: '      "Content-Type": "application/json"',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 9,
          newLineNumber: 17,
          content: '    }',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 10,
          newLineNumber: 18,
          content: '  }',
          isConflict: false,
        },
      ],
      hasConflicts: true,
    },
  ],
  additions: 15,
  deletions: 10,
  isNew: false,
  isDeleted: false,
  isRenamed: false,
  hasConflicts: true,
};

// File Diff Mock Data - Binary File
export const mockBinaryFileDiff: FileDiff = {
  from: 'assets/logo.png',
  to: 'assets/logo.png',
  hunks: [],
  additions: 0,
  deletions: 0,
  isNew: false,
  isDeleted: false,
  isRenamed: false,
  hasConflicts: false,
};

// File Diff Mock Data - Large File with Many Changes
export const mockLargeFileDiff: FileDiff = {
  from: 'src/data/constants.ts',
  to: 'src/data/constants.ts',
  hunks: [
    {
      oldStart: 1,
      oldLines: 50,
      newStart: 1,
      newLines: 75,
      changes: [
        ...Array.from({ length: 30 }, (_, i) => ({
          type: 'normal' as const,
          oldLineNumber: i + 1,
          newLineNumber: i + 1,
          content: `export const CONSTANT_${i + 1} = '${i + 1}';`,
          isConflict: false,
        })),
        ...Array.from({ length: 25 }, (_, i) => ({
          type: 'add' as const,
          newLineNumber: i + 31,
          content: `export const NEW_CONSTANT_${i + 1} = '${i + 1}';`,
          isConflict: false,
        })),
        ...Array.from({ length: 20 }, (_, i) => ({
          type: 'normal' as const,
          oldLineNumber: i + 31,
          newLineNumber: i + 56,
          content: `export const CONSTANT_${i + 31} = '${i + 31}';`,
          isConflict: false,
        })),
      ],
      hasConflicts: false,
    },
  ],
  additions: 35,
  deletions: 10,
  isNew: false,
  isDeleted: false,
  isRenamed: false,
  hasConflicts: false,
};

// File Diff Mock Data - Staged File
export const mockStagedFileDiff: FileDiff = {
  from: 'README.md',
  to: 'README.md',
  hunks: [
    {
      oldStart: 1,
      oldLines: 10,
      newStart: 1,
      newLines: 12,
      changes: [
        {
          type: 'normal',
          oldLineNumber: 1,
          newLineNumber: 1,
          content: '# My Project',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 2,
          newLineNumber: 2,
          content: '',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 3,
          newLineNumber: 3,
          content: 'A great project for doing amazing things.',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 4,
          newLineNumber: 4,
          content: '',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 5,
          content: '## Features',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 6,
          content: '',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 7,
          content: '- New feature added',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 5,
          newLineNumber: 8,
          content: '',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 6,
          newLineNumber: 9,
          content: '## Installation',
          isConflict: false,
        },
        {
          type: 'del',
          oldLineNumber: 7,
          content: 'Run: npm install',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 10,
          content: 'Run: `npm install` or `pnpm install`',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 8,
          newLineNumber: 11,
          content: '',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 9,
          newLineNumber: 12,
          content: '## Usage',
          isConflict: false,
        },
      ],
      hasConflicts: false,
    },
  ],
  additions: 3,
  deletions: 1,
  isNew: false,
  isDeleted: false,
  isRenamed: false,
  hasConflicts: false,
};

// Script File with Mixed Changes
export const mockScriptFileDiff: FileDiff = {
  from: 'scripts/deploy.sh',
  to: 'scripts/deploy.sh',
  hunks: [
    {
      oldStart: 1,
      oldLines: 8,
      newStart: 1,
      newLines: 12,
      changes: [
        {
          type: 'normal',
          oldLineNumber: 1,
          newLineNumber: 1,
          content: '#!/bin/bash',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 2,
          newLineNumber: 2,
          content: '',
          isConflict: false,
        },
        {
          type: 'del',
          oldLineNumber: 3,
          content: 'set -e',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 3,
          content: 'set -euo pipefail',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 4,
          newLineNumber: 4,
          content: '',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 5,
          newLineNumber: 5,
          content: 'echo "Starting deployment..."',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 6,
          content: 'echo "Environment: $DEPLOY_ENV"',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 6,
          newLineNumber: 7,
          content: '',
          isConflict: false,
        },
        {
          type: 'del',
          oldLineNumber: 7,
          content: 'npm run build',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 8,
          content: 'pnpm build',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 9,
          content: 'pnpm test',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 10,
          content: '',
          isConflict: false,
        },
        {
          type: 'add',
          newLineNumber: 11,
          content: 'echo "Deployment complete"',
          isConflict: false,
        },
        {
          type: 'normal',
          oldLineNumber: 8,
          newLineNumber: 12,
          content: '',
          isConflict: false,
        },
      ],
      hasConflicts: false,
    },
  ],
  additions: 6,
  deletions: 2,
  isNew: false,
  isDeleted: false,
  isRenamed: false,
  hasConflicts: false,
};

// Complete mock data map for easy access
export const mockFileDiffs = new Map<string, FileDiff>([
  ['src/features/new-feature.ts', mockNewFileDiff],
  ['src/legacy/old-component.tsx', mockDeletedFileDiff],
  ['src/components/UserProfile.tsx', mockModifiedFileDiff],
  ['src/utils/helpers.ts', mockRenamedFileDiff],
  ['src/config/settings.json', mockConflictFileDiff],
  ['assets/logo.png', mockBinaryFileDiff],
  ['src/data/constants.ts', mockLargeFileDiff],
  ['README.md', mockStagedFileDiff],
  ['scripts/deploy.sh', mockScriptFileDiff],
]);

/**
 * Additional Git File Use Cases to Consider:
 *
 * 1. ✅ Binary files (images, PDFs, executables) - Covered
 * 2. ✅ Large files with many changes - Covered
 * 3. Whitespace-only changes (formatting)
 * 4. Permission changes (chmod +x)
 * 5. Submodule updates
 * 6. Symlink changes
 * 7. Files with very long lines (horizontal scrolling)
 * 8. Unicode and emoji content
 * 9. Files with mixed line endings (CRLF vs LF)
 * 10. Empty files (0 bytes)
 * 11. Partial staging (some changes staged, some not)
 * 12. Triple-conflict markers (3-way merge with base)
 */

/**
 * Mock Chat Message - Permission Action Display
 * Example of accepted git diff change shown in chat interface
 */
export const mockPermissionChatMessage: ChatMessage = {
  id: 'msg-permission-1',
  role: 'assistant',
  content: "I've updated the deployment script to use pnpm and added better error handling.",
  timestamp: new Date('2025-01-15T10:30:00'),
  permissionAction: {
    type: 'accepted',
    file_path: 'scripts/deploy.sh',
    old_string: `set -e

echo "Starting deployment..."

npm run build`,
    new_string: `set -euo pipefail

echo "Starting deployment..."
echo "Environment: $DEPLOY_ENV"

pnpm build
pnpm test

echo "Deployment complete"`,
    timestamp: new Date('2025-01-15T10:30:00'),
  },
};
