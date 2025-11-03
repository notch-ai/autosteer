import { logger } from '@/commons/utils/logger';
import { SearchService } from '@/commons/utils/SearchService';
import { useSlashCommandsStore, useProjectsStore } from '@/stores';
import { useEffect, useMemo, useRef } from 'react';

interface SlashCommand {
  command: string;
  label: string;
  description: string;
  icon: string;
  action?: () => void;
  content?: string;
}

// Built-in Claude Code slash commands
export const builtInCommands: SlashCommand[] = [
  // {
  //   command: 'add-dir',
  //   label: 'Add Directory',
  //   description: 'Add additional working directories',
  //   icon: '📁',
  //   action: () => {},
  // },
  // {
  //   command: 'agents',
  //   label: 'Agents',
  //   description: 'Manage custom AI sub agents for specialized tasks',
  //   icon: '🤖',
  //   action: () => {},
  // },
  // {
  //   command: 'bug',
  //   label: 'Report Bug',
  //   description: 'Report bugs (sends conversation to Anthropic)',
  //   icon: '🐛',
  //   action: () => {},
  // },
  // {
  //   command: 'clear',
  //   label: 'Clear',
  //   description: 'Clear conversation history',
  //   icon: '🧹',
  //   action: () => {},
  // },
  {
    command: 'compact',
    label: 'Compact',
    description: 'Compact conversation with optional focus instructions',
    icon: '📦',
    action: () => {},
  },
  // {
  //   command: 'config',
  //   label: 'Config',
  //   description: 'View/modify configuration',
  //   icon: '⚙️',
  //   action: () => {},
  // },
  // {
  //   command: 'cost',
  //   label: 'Cost',
  //   description: 'Show token usage statistics',
  //   icon: '💰',
  //   action: () => {},
  // },
  // {
  //   command: 'doctor',
  //   label: 'Doctor',
  //   description: 'Checks the health of your Claude Code installation',
  //   icon: '🩺',
  //   action: () => {},
  // },
  // {
  //   command: 'help',
  //   label: 'Help',
  //   description: 'Get usage help',
  //   icon: '❓',
  //   action: () => {},
  // },
  // {
  //   command: 'init',
  //   label: 'Initialize',
  //   description: 'Initialize project with CLAUDE.md guide',
  //   icon: '🚀',
  //   action: () => {},
  // },
  // {
  //   command: 'login',
  //   label: 'Login',
  //   description: 'Switch Anthropic accounts',
  //   icon: '🔑',
  //   action: () => {},
  // },
  // {
  //   command: 'logout',
  //   label: 'Logout',
  //   description: 'Sign out from your Anthropic account',
  //   icon: '🚪',
  //   action: () => {},
  // },
  // {
  //   command: 'mcp',
  //   label: 'MCP',
  //   description: 'Manage MCP server connections and OAuth authentication',
  //   icon: '🔌',
  //   action: () => {},
  // },
  // {
  //   command: 'memory',
  //   label: 'Memory',
  //   description: 'Edit CLAUDE.md memory files',
  //   icon: '🧠',
  //   action: () => {},
  // },
  // {
  //   command: 'model',
  //   label: 'Model',
  //   description: 'Select or change the AI model',
  //   icon: '🤖',
  //   action: () => {},
  // },
  // {
  //   command: 'permissions',
  //   label: 'Permissions',
  //   description: 'View or update permissions',
  //   icon: '🔐',
  //   action: () => {},
  // },
  // {
  //   command: 'pr_comments',
  //   label: 'PR Comments',
  //   description: 'View pull request comments',
  //   icon: '💬',
  //   action: () => {},
  // },
  // {
  //   command: 'review',
  //   label: 'Review',
  //   description: 'Request code review',
  //   icon: '👀',
  //   action: () => {},
  // },
  // {
  //   command: 'status',
  //   label: 'Status',
  //   description: 'View account and system statuses',
  //   icon: '📊',
  //   action: () => {},
  // },
  // {
  //   command: 'terminal-setup',
  //   label: 'Terminal Setup',
  //   description: 'Install Shift+Enter key binding for newlines',
  //   icon: '⌨️',
  //   action: () => {},
  // },
  // {
  //   command: 'vim',
  //   label: 'Vim Mode',
  //   description: 'Enter vim mode for alternating insert and command modes',
  //   icon: '⚡',
  //   action: () => {},
  // },
];

export const useSlashCommandLogic = (query: string) => {
  const slashCommands = useSlashCommandsStore((state) => state.slashCommands || []);
  const loadSlashCommands = useSlashCommandsStore((state) => state.loadSlashCommands);
  const selectedProjectId = useProjectsStore((state) => state.selectedProjectId);

  // Create SearchService instance
  const searchServiceRef = useRef<SearchService<SlashCommand> | null>(null);

  // Load commands when the hook is first used OR when selected project changes
  useEffect(() => {
    loadSlashCommands().catch((error) => {
      logger.error('[useSlashCommandLogic] Failed to load slash commands:', error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  // Convert custom commands from store
  const customCommands = useMemo(() => {
    return slashCommands.map((cmd) => ({
      command: cmd.name, // Don't add slash, it will be added in display
      label: cmd.name,
      description: cmd.description || '',
      icon: '📄',
      action: () => {},
      content: cmd.prompt,
    }));
  }, [slashCommands]);

  // Initialize SearchService when commands change
  useEffect(() => {
    const allCommands = [...customCommands, ...builtInCommands];

    // Create SearchService instance if it doesn't exist
    if (!searchServiceRef.current) {
      searchServiceRef.current = new SearchService<SlashCommand>({
        name: 'SlashCommand',
        limit: 20,
      });
    }

    // Initialize index with all commands
    searchServiceRef.current.initializeIndex(
      allCommands,
      (cmd) => `${cmd.command} ${cmd.label} ${cmd.description}`
    );
  }, [customCommands]);

  // Filter commands based on query using SearchService
  const filteredCommands = useMemo(() => {
    const allCommands = [...customCommands, ...builtInCommands];

    if (!query) {
      // Show all commands when no query, sorted alphabetically
      return allCommands.sort((a, b) =>
        a.command.toLowerCase().localeCompare(b.command.toLowerCase())
      );
    }

    if (!searchServiceRef.current) {
      return allCommands;
    }

    // Use SearchService for unified search
    return searchServiceRef.current.search(query, (cmd) => [
      cmd.command,
      cmd.label,
      cmd.description,
    ]);
  }, [query, customCommands]);

  return {
    filteredCommands,
    customCommands,
    builtInCommands,
  };
};
