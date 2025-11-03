import {
  validateBranchName,
  isValidBranchName,
  sanitizeBranchName,
} from '@/services/validation/branchNameValidator';

describe('branchNameValidator', () => {
  describe('validateBranchName', () => {
    it('should accept valid single-word branch names', () => {
      const result = validateBranchName('research');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('research');
    });

    it('should accept valid slash format branch names', () => {
      const result = validateBranchName('feature/new-test');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('feature/new-test');
    });

    it('should reject empty branch names', () => {
      const result = validateBranchName('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('should reject branch names with consecutive slashes', () => {
      const result = validateBranchName('feature//double-slash');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('consecutive slashes');
    });

    it('should reject branch names starting with hyphen', () => {
      const result = validateBranchName('--invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('start with');
    });

    it('should reject branch names starting with dot', () => {
      const result = validateBranchName('.hidden');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('start with a dot');
    });

    it('should reject branch names ending with .lock', () => {
      const result = validateBranchName('branch.lock');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('.lock');
    });

    it('should reject branch names with spaces', () => {
      const result = validateBranchName('has spaces');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('spaces');
    });

    it('should reject branch names with leading slash', () => {
      const result = validateBranchName('/leading');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('start');
    });

    it('should reject branch names with trailing slash', () => {
      const result = validateBranchName('trailing/');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('end');
    });
  });

  describe('isValidBranchName', () => {
    it('should return true for valid names', () => {
      expect(isValidBranchName('research')).toBe(true);
      expect(isValidBranchName('feature/test')).toBe(true);
      expect(isValidBranchName('main')).toBe(true);
      expect(isValidBranchName('bugfix/issue-123')).toBe(true);
    });

    it('should return false for invalid names', () => {
      expect(isValidBranchName('')).toBe(false);
      expect(isValidBranchName('--invalid')).toBe(false);
      expect(isValidBranchName('.hidden')).toBe(false);
      expect(isValidBranchName('branch.lock')).toBe(false);
    });
  });

  describe('sanitizeBranchName', () => {
    it('should replace spaces with hyphens', () => {
      expect(sanitizeBranchName('has spaces')).toBe('has-spaces');
    });

    it('should remove leading dots', () => {
      expect(sanitizeBranchName('.hidden')).toBe('hidden');
    });

    it('should remove consecutive slashes', () => {
      expect(sanitizeBranchName('feature//test')).toBe('feature/test');
    });

    it('should remove leading slashes', () => {
      expect(sanitizeBranchName('/leading')).toBe('leading');
    });

    it('should remove trailing slashes', () => {
      expect(sanitizeBranchName('trailing/')).toBe('trailing');
    });

    it('should handle multiple issues at once', () => {
      expect(sanitizeBranchName('  //.bad//name  ')).toBe('bad/name');
    });
  });
});
