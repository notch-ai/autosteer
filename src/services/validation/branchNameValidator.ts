/**
 * Branch Name Validator
 * Validates git branch names according to git naming rules
 * Supports both single-word names (e.g., "research") and slash format (e.g., "feature/new-test")
 */

export interface BranchValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * Validate a branch name according to git naming rules
 * @param name - The branch name to validate
 * @returns Validation result with error message if invalid
 */
export function validateBranchName(name: string): BranchValidationResult {
  // Empty name check
  if (!name || name.trim().length === 0) {
    return {
      valid: false,
      error: 'Branch name cannot be empty',
    };
  }

  const trimmedName = name.trim();

  // Git branch naming rules:
  // - Cannot start or end with a slash
  // - Cannot contain consecutive slashes
  // - Cannot contain spaces
  // - Cannot start with a dot or hyphen
  // - Cannot end with .lock
  // - Cannot contain special characters: ~, ^, :, ?, *, [, \, ASCII control characters

  // Check for leading/trailing slashes
  if (trimmedName.startsWith('/') || trimmedName.endsWith('/')) {
    return {
      valid: false,
      error: 'Branch name cannot start or end with a slash',
    };
  }

  // Check for consecutive slashes
  if (trimmedName.includes('//')) {
    return {
      valid: false,
      error: 'Branch name cannot contain consecutive slashes',
    };
  }

  // Check for spaces
  if (trimmedName.includes(' ')) {
    return {
      valid: false,
      error: 'Branch name cannot contain spaces',
    };
  }

  // Check for leading dot or hyphen
  if (trimmedName.startsWith('.') || trimmedName.startsWith('-')) {
    return {
      valid: false,
      error: 'Branch name cannot start with a dot or hyphen',
    };
  }

  // Check for .lock suffix
  if (trimmedName.endsWith('.lock')) {
    return {
      valid: false,
      error: 'Branch name cannot end with .lock',
    };
  }

  // Check for invalid characters
  // eslint-disable-next-line no-control-regex
  const invalidChars = /[~^:?*[\\\x00-\x1f\x7f]/;
  if (invalidChars.test(trimmedName)) {
    return {
      valid: false,
      error:
        'Branch name contains invalid characters (~, ^, :, ?, *, [, \\, or control characters)',
    };
  }

  // Check for @{ which is reserved
  if (trimmedName.includes('@{')) {
    return {
      valid: false,
      error: 'Branch name cannot contain @{',
    };
  }

  // Valid branch name
  return {
    valid: true,
    sanitized: trimmedName,
  };
}

/**
 * Simple boolean check if a branch name is valid
 * @param name - The branch name to check
 * @returns true if valid, false otherwise
 */
export function isValidBranchName(name: string): boolean {
  return validateBranchName(name).valid;
}

/**
 * Sanitize a branch name by replacing invalid characters
 * @param name - The branch name to sanitize
 * @returns Sanitized branch name
 */
export function sanitizeBranchName(name: string): string {
  let sanitized = name.trim();

  // Replace spaces with hyphens
  sanitized = sanitized.replace(/\s+/g, '-');

  // Remove invalid characters
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[~^:?*[\\\x00-\x1f\x7f]/g, '');

  // Remove @{
  sanitized = sanitized.replace(/@{/g, '');

  // Remove consecutive slashes
  sanitized = sanitized.replace(/\/+/g, '/');

  // Remove leading/trailing slashes
  sanitized = sanitized.replace(/^\/+|\/+$/g, '');

  // Remove leading dots and hyphens
  sanitized = sanitized.replace(/^[.-]+/, '');

  // Remove .lock suffix
  sanitized = sanitized.replace(/\.lock$/, '');

  return sanitized;
}
