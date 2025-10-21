/**
 * Convert repository URL and branch name to a valid folder name
 * @param repoUrl - Git repository URL (SSH or HTTPS)
 * @param branchName - Branch name
 * @returns Sanitized folder name
 */
export function convertToFolderName(repoUrl: string, branchName: string): string {
  // Extract repository name from URL
  let repoName = '';

  // Handle SSH format: git@github.com:user/repo.git
  if (repoUrl.includes('git@')) {
    const match = repoUrl.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (match) {
      repoName = match[1].split('/').pop() || '';
    }
  }
  // Handle HTTPS format: https://github.com/user/repo.git
  else if (repoUrl.includes('://')) {
    const match = repoUrl.match(/\/([^/]+?)(?:\.git)?$/);
    if (match) {
      repoName = match[1];
    }
  }

  // Fallback to full URL if parsing fails
  if (!repoName) {
    repoName = repoUrl;
  }

  // Extract the last part of the branch name (after the last /)
  const branchPart = branchName.split('/').pop() || branchName;

  // Combine repo name and branch name
  const combined = `${repoName}-${branchPart}`;

  // Replace non-alphanumeric characters with hyphens
  const sanitized = combined.replace(/[^a-zA-Z0-9]+/g, '-');

  // Remove leading/trailing hyphens and collapse multiple hyphens
  const cleaned = sanitized
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .toLowerCase();

  // Ensure the folder name is not empty
  return cleaned || 'unnamed-worktree';
}

/**
 * Validate if a string is a valid Git repository URL
 * @param url - URL to validate
 * @returns true if valid, false otherwise
 */
export function isValidGitUrl(url: string): boolean {
  // SSH format
  const sshPattern = /^git@[\w.-]+:[\w.-]+\/[\w.-]+(?:\.git)?$/;

  // HTTPS format
  const httpsPattern = /^https?:\/\/[\w.-]+\/[\w.-]+\/[\w.-]+(?:\.git)?$/;

  return sshPattern.test(url) || httpsPattern.test(url);
}

/**
 * Extract repository name from Git URL
 * @param repoUrl - Git repository URL
 * @returns Repository name or null if cannot parse
 */
export function extractRepoName(repoUrl: string): string | null {
  // Try SSH format first
  let match = repoUrl.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (match) {
    return match[1].split('/').pop() || null;
  }

  // Try HTTPS format
  match = repoUrl.match(/\/([^/]+?)(?:\.git)?$/);
  if (match) {
    return match[1];
  }

  return null;
}

/**
 * Get folder name from path
 * @param path - Full file path
 * @returns Folder name
 */
export function getFolderName(path: string): string {
  return path.split('/').pop() || path;
}

/**
 * Format repository and branch name for display
 * @param repoUrl - Git repository URL (optional)
 * @param branchName - Branch name (optional)
 * @returns Formatted string like "repo-name: branch-name" or fallback
 */
export function formatRepoDisplay(repoUrl?: string, branchName?: string): string | null {
  if (!repoUrl || !branchName) {
    return null;
  }

  const repoName = extractRepoName(repoUrl);
  if (!repoName) {
    return null;
  }

  return `${repoName}: ${branchName}`;
}
