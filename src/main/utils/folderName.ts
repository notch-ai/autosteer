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
    // Remove trailing slashes first
    const cleanUrl = repoUrl.replace(/\/+$/, '');
    const match = cleanUrl.match(/\/([^/]+?)(?:\.git)?$/);
    if (match) {
      repoName = match[1];
    }
  }
  // Handle local file paths (Unix and Windows)
  else if (repoUrl.startsWith('/') || repoUrl.match(/^[A-Za-z]:\\/)) {
    // For Windows paths, normalize backslashes to forward slashes
    const normalizedPath = repoUrl.replace(/\\/g, '/');
    const match = normalizedPath.match(/\/([^/]+?)(?:\.git)?$/);
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
