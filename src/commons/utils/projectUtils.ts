/**
 * Extract folder name from a local path
 * @param localPath - The full local path
 * @returns The folder name or null if path is invalid
 */
export const getFolderName = (localPath: string | undefined): string | null => {
  if (!localPath) return null;

  // Remove the ~/.autosteer/worktrees/ prefix if present
  const prefix = '.autosteer/worktrees/';
  const startIndex = localPath.indexOf(prefix);

  if (startIndex !== -1) {
    return localPath.substring(startIndex + prefix.length);
  }

  // If no prefix found, just return the last part of the path
  const parts = localPath.split('/');
  return parts[parts.length - 1];
};
