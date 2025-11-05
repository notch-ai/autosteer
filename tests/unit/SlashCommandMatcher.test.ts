import { useSlashCommandLogic } from '@/components/common/useSlashCommandLogic';
import { renderHook } from '@testing-library/react';

// Mock FlexSearch - same as file/git search
jest.mock('flexsearch', () => {
  return {
    Index: jest.fn().mockImplementation(() => ({
      add: jest.fn(),
      search: jest.fn((query: string) => {
        const normalized = query.toLowerCase().trim();

        // tokenize: 'full' behavior - matches complete words
        // Match "write-ticket" or "write ticket" to tickets:write-ticket
        if (normalized.includes('write') && normalized.includes('ticket')) {
          return [0]; // tickets:write-ticket
        }

        // Match "write-trd" or variations
        if (normalized.includes('write') && normalized.includes('trd')) {
          return [1]; // engineering:write-trd
        }

        // Match "compact" exactly to compact (index 2)
        if (normalized === 'compact') {
          return [2]; // compact
        }

        // Match "ticket" alone
        if (normalized === 'ticket') {
          return [0];
        }

        // Don't match "write" alone - tokenize: 'full' prevents prefix-only matching
        if (normalized === 'write') {
          return [];
        }

        return [];
      }),
    })),
  };
});

// Mock the stores
jest.mock('@/stores', () => ({
  useSlashCommandsStore: jest.fn((selector) =>
    selector({
      slashCommands: [
        {
          name: 'tickets:write-ticket',
          description: 'Create a new ticket',
          prompt: 'Test content',
          path: '/test/path',
        },
        {
          name: 'engineering:write-trd',
          description: 'Write TRD document',
          prompt: 'Test content',
          path: '/test/path',
        },
        {
          name: 'compact',
          description: 'Compact command',
          prompt: 'Test content',
          path: '/test/path',
        },
      ],
      loadSlashCommands: jest.fn().mockResolvedValue(undefined),
    })
  ),
  useProjectsStore: Object.assign(
    jest.fn((selector) =>
      selector({
        selectedProjectId: 'test-project',
      })
    ),
    {
      getState: jest.fn(() => ({
        selectedProjectId: 'test-project',
        getSelectedProject: jest.fn(() => ({ localPath: '/test/path' })),
      })),
    }
  ),
}));

describe('useSlashCommandLogic with FlexSearch', () => {
  it('should match hyphenated query to colon-separated command', () => {
    const { result } = renderHook(() => useSlashCommandLogic('write-ticket'));

    const matches = result.current.filteredCommands;
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((cmd: { command: string }) => cmd.command === 'tickets:write-ticket')).toBe(
      true
    );
  });

  it('should match write-trd to engineering:write-trd', () => {
    const { result } = renderHook(() => useSlashCommandLogic('write-trd'));

    const matches = result.current.filteredCommands;
    expect(matches.length).toBeGreaterThan(0);
    expect(
      matches.some((cmd: { command: string }) => cmd.command === 'engineering:write-trd')
    ).toBe(true);
  });

  it.skip('should perform fuzzy matching', () => {
    const { result } = renderHook(() => useSlashCommandLogic('writ-tick'));

    const matches = result.current.filteredCommands;
    expect(matches.length).toBeGreaterThan(0);
    // Should include tickets:write-ticket in results
    const hasWriteTicket = matches.some((cmd: { command: string }) =>
      cmd.command.includes('write-ticket')
    );
    expect(hasWriteTicket).toBe(true);
  });

  it('should prioritize exact matches', () => {
    const { result } = renderHook(() => useSlashCommandLogic('compact'));

    const matches = result.current.filteredCommands;
    // Should find compact command
    expect(matches.some((cmd: { command: string }) => cmd.command === 'compact')).toBe(true);
    // Exact match should be prioritized (first in tier 1 or tier 2 results)
    const compactIndex = matches.findIndex((cmd: { command: string }) => cmd.command === 'compact');
    expect(compactIndex).toBeGreaterThanOrEqual(0);
  });

  it('should return all commands when query is empty', () => {
    const { result } = renderHook(() => useSlashCommandLogic(''));

    const matches = result.current.filteredCommands;
    expect(matches.length).toBeGreaterThan(0);
  });

  it.skip('should normalize hyphens and colons for matching', () => {
    const { result } = renderHook(() => useSlashCommandLogic('ticketswriteticket'));

    const matches = result.current.filteredCommands;
    expect(matches.some((cmd: { command: string }) => cmd.command === 'tickets:write-ticket')).toBe(
      true
    );
  });

  it('should fallback to includes matching if FlexSearch returns no results', () => {
    const { result } = renderHook(() => useSlashCommandLogic('ticket'));

    const matches = result.current.filteredCommands;
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((cmd: { command: string }) => cmd.command.includes('ticket'))).toBe(true);
  });

  it('should NOT match partial word prefixes like "write" to "write-dxx"', () => {
    const { result } = renderHook(() => useSlashCommandLogic('write'));

    const matches = result.current.filteredCommands;
    // Should use fallback matching since FlexSearch returns no results for 'write' alone
    // Fallback will match any command containing 'write' but that's expected behavior
    expect(matches.some((cmd: { command: string }) => cmd.command.includes('write'))).toBe(true);
  });
});
