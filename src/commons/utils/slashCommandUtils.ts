/**
 * Utility functions for slash command formatting and conversion
 */

/**
 * Converts a slash command from /<x>:<y> format to "run command /<x>/<y>" format
 * This is required for Claude Code to properly process the command.
 *
 * @param command - The slash command to convert (e.g., "/engineering:write-docs")
 * @returns The converted command in Claude Code format (e.g., "run command /engineering/write-docs")
 *
 * @example
 * convertSlashCommandFormat("/engineering:write-docs") // "run command /engineering/write-docs"
 * convertSlashCommandFormat("/compact") // "/compact"
 * convertSlashCommandFormat("engineering:write-docs") // "run command /engineering/write-docs"
 */
export function convertSlashCommandFormat(command: string): string {
  // Remove leading slash if present for consistent processing
  const cleanCommand = command.startsWith('/') ? command.slice(1) : command;

  // Check if command contains a colon (namespace separator)
  if (cleanCommand.includes(':')) {
    // Convert colon to slash and prepend "run command /"
    const convertedCommand = cleanCommand.replace(':', '/');
    return `run command /${convertedCommand}`;
  }

  // No colon, return as-is with leading slash
  return `/${cleanCommand}`;
}

/**
 * Checks if a command is a custom slash command (contains a namespace separator)
 *
 * @param command - The slash command to check
 * @returns true if the command is a custom command with namespace separator
 *
 * @example
 * isCustomSlashCommand("/engineering:write-docs") // true
 * isCustomSlashCommand("/compact") // false
 */
export function isCustomSlashCommand(command: string): boolean {
  const cleanCommand = command.startsWith('/') ? command.slice(1) : command;
  return cleanCommand.includes(':');
}
