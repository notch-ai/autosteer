import React, { useMemo } from 'react';
import { CommandMenu, CommandMenuItem } from '@/features/chat/components/CommandMenu';
import { useSlashCommandsStore } from '@/stores';

interface SlashCommand {
  command: string;
  label: string;
  description: string;
  icon: string;
  action?: () => void;
  content?: string; // Full markdown content for Claude Code commands
}

interface SlashCommandAdapterProps {
  query: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  position?: { top: number; left: number; width?: number };
  onTabSelect?: (command: SlashCommand) => void; // Optional handler for Tab key
}

// Built-in Claude Code slash commands
const builtInCommands: SlashCommand[] = [
  {
    command: '/add-dir',
    label: 'Add Directory',
    description: 'Add additional working directories',
    icon: '📁',
    action: () => {},
  },
  {
    command: '/agents',
    label: 'Agents',
    description: 'Manage custom AI sub agents for specialized tasks',
    icon: '🤖',
    action: () => {},
  },
  {
    command: '/bug',
    label: 'Report Bug',
    description: 'Report bugs (sends conversation to Anthropic)',
    icon: '🐛',
    action: () => {},
  },
  {
    command: '/clear',
    label: 'Clear',
    description: 'Clear conversation history',
    icon: '🧹',
    action: () => {},
  },
  {
    command: '/compact',
    label: 'Compact',
    description: 'Compact conversation with optional focus instructions',
    icon: '📦',
    action: () => {},
  },
  {
    command: '/config',
    label: 'Config',
    description: 'View/modify configuration',
    icon: '⚙️',
    action: () => {},
  },
  {
    command: '/cost',
    label: 'Cost',
    description: 'Show token usage statistics',
    icon: '💰',
    action: () => {},
  },
  {
    command: '/doctor',
    label: 'Doctor',
    description: 'Checks the health of your Claude Code installation',
    icon: '🩺',
    action: () => {},
  },
  {
    command: '/help',
    label: 'Help',
    description: 'Get usage help',
    icon: '❓',
    action: () => {},
  },
  {
    command: '/init',
    label: 'Initialize',
    icon: '🚀',
    action: () => {},
  },
  {
    command: '/login',
    label: 'Login',
    description: 'Switch Anthropic accounts',
    icon: '🔑',
    action: () => {},
  },
  {
    command: '/logout',
    label: 'Logout',
    description: 'Sign out from your Anthropic account',
    icon: '🚪',
    action: () => {},
  },
  {
    command: '/mcp',
    label: 'MCP',
    description: 'Manage MCP server connections and OAuth authentication',
    icon: '🔌',
    action: () => {},
  },
  {
    command: '/memory',
    label: 'Memory',
    icon: '🧠',
    action: () => {},
  },
  {
    command: '/model',
    label: 'Model',
    description: 'Select or change the AI model',
    icon: '🤖',
    action: () => {},
  },
  {
    command: '/permissions',
    label: 'Permissions',
    description: 'View or update permissions',
    icon: '🔐',
    action: () => {},
  },
  {
    command: '/pr_comments',
    label: 'PR Comments',
    description: 'View pull request comments',
    icon: '💬',
    action: () => {},
  },
  {
    command: '/review',
    label: 'Review',
    description: 'Request code review',
    icon: '👀',
    action: () => {},
  },
  {
    command: '/status',
    label: 'Status',
    description: 'View account and system statuses',
    icon: '📊',
    action: () => {},
  },
  {
    command: '/terminal-setup',
    label: 'Terminal Setup',
    description: 'Install Shift+Enter key binding for newlines',
    icon: '⌨️',
    action: () => {},
  },
  {
    command: '/vim',
    label: 'Vim Mode',
    description: 'Enter vim mode for alternating insert and command modes',
    icon: '⚡',
    action: () => {},
  },
];

export const SlashCommandAdapter: React.FC<SlashCommandAdapterProps> = ({
  query,
  onSelect,
  onClose,
  position,
  onTabSelect,
}) => {
  // Get slash commands from store
  const slashCommands = useSlashCommandsStore((state) => state.slashCommands || []);

  // Convert custom commands from store to the format expected by this component
  const customCommands = useMemo(
    () =>
      slashCommands.map((cmd) => ({
        command: `/${cmd.name}`,
        label: cmd.name,
        description: cmd.description || '',
        icon: '📄', // Default icon for dynamic commands
        action: () => {},
        content: cmd.prompt, // Store the full content for Claude Code
      })),
    [slashCommands]
  );

  // Filter commands based on query and convert to CommandMenuItem format
  const commandMenuItems = useMemo(() => {
    let commandsToShow: SlashCommand[];

    if (!query) {
      // No query (just "/" typed), show ALL custom commands without filtering
      commandsToShow = customCommands;
    } else {
      // Query has text (user typed more than just "/"), include both custom and built-in commands
      const allCommands = [...customCommands, ...builtInCommands];
      commandsToShow = allCommands.filter(
        (cmd) =>
          cmd.command.toLowerCase().includes(query.toLowerCase()) ||
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.description.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Convert to CommandMenuItem format
    return commandsToShow.map(
      (cmd): CommandMenuItem => ({
        id: cmd.command,
        label: cmd.command,
        description: cmd.description,
        icon: cmd.icon,
        metadata: {
          originalCommand: cmd,
        },
      })
    );
  }, [query, customCommands]);

  const handleSelect = (item: CommandMenuItem) => {
    const originalCommand = item.metadata?.originalCommand as SlashCommand;
    if (originalCommand) {
      onSelect(originalCommand);
    }
  };

  const handleTabComplete = onTabSelect
    ? (item: CommandMenuItem) => {
        const originalCommand = item.metadata?.originalCommand as SlashCommand;
        if (originalCommand) {
          onTabSelect(originalCommand);
        }
      }
    : undefined;

  const menuProps: any = {
    items: commandMenuItems,
    isOpen: true,
    onSelect: handleSelect,
    onClose: onClose,
    searchQuery: query,
    emptyMessage: query ? `No commands found for "${query}"` : 'No commands available',
    className: 'slash-commands-adapter',
  };

  if (position) {
    menuProps.position = position;
  }

  if (handleTabComplete) {
    menuProps.onTabComplete = handleTabComplete;
  }

  return <CommandMenu {...menuProps} />;
};
