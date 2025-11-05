/**
 * Unit Tests for Branch Name Validator
 * Tests git branch name validation logic according to git naming rules
 * Target: 80%+ coverage
 */

import {
  validateBranchName,
  isValidBranchName,
  sanitizeBranchName,
} from '@/services/validation/branchNameValidator';

describe('BranchNameValidator', () => {
  describe('validateBranchName', () => {
    describe('valid branch names', () => {
      it('should accept simple branch names', () => {
        console.log('[Test] Validating simple branch name');
        const result = validateBranchName('feature');

        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe('feature');
        expect(result.error).toBeUndefined();
      });

      it('should accept branch names with slashes', () => {
        console.log('[Test] Validating branch name with slashes');
        const result = validateBranchName('feature/new-feature');

        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe('feature/new-feature');
      });

      it('should accept branch names with hyphens', () => {
        console.log('[Test] Validating branch name with hyphens');
        const result = validateBranchName('my-feature-branch');

        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe('my-feature-branch');
      });

      it('should accept branch names with numbers', () => {
        console.log('[Test] Validating branch name with numbers');
        const result = validateBranchName('feature-123');

        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe('feature-123');
      });

      it('should accept branch names with underscores', () => {
        console.log('[Test] Validating branch name with underscores');
        const result = validateBranchName('feature_branch');

        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe('feature_branch');
      });

      it('should accept nested paths', () => {
        console.log('[Test] Validating nested branch paths');
        const result = validateBranchName('team/member/feature');

        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe('team/member/feature');
      });

      it('should trim whitespace', () => {
        console.log('[Test] Validating branch name with whitespace');
        const result = validateBranchName('  feature  ');

        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe('feature');
      });

      it('should accept mixed case names', () => {
        console.log('[Test] Validating mixed case branch name');
        const result = validateBranchName('Feature/NewBranch');

        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe('Feature/NewBranch');
      });
    });

    describe('invalid branch names - empty', () => {
      it('should reject empty string', () => {
        console.log('[Test] Rejecting empty string');
        const result = validateBranchName('');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Branch name cannot be empty');
      });

      it('should reject only whitespace', () => {
        console.log('[Test] Rejecting only whitespace');
        const result = validateBranchName('   ');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Branch name cannot be empty');
      });
    });

    describe('invalid branch names - slashes', () => {
      it('should reject leading slash', () => {
        console.log('[Test] Rejecting leading slash');
        const result = validateBranchName('/feature');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Branch name cannot start or end with a slash');
      });

      it('should reject trailing slash', () => {
        console.log('[Test] Rejecting trailing slash');
        const result = validateBranchName('feature/');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Branch name cannot start or end with a slash');
      });

      it('should reject consecutive slashes', () => {
        console.log('[Test] Rejecting consecutive slashes');
        const result = validateBranchName('feature//branch');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Branch name cannot contain consecutive slashes');
      });

      it('should reject multiple consecutive slashes', () => {
        console.log('[Test] Rejecting multiple consecutive slashes');
        const result = validateBranchName('feature///branch');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Branch name cannot contain consecutive slashes');
      });
    });

    describe('invalid branch names - spaces', () => {
      it('should reject spaces in branch name', () => {
        console.log('[Test] Rejecting spaces in branch name');
        const result = validateBranchName('feature branch');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Branch name cannot contain spaces');
      });

      it('should reject multiple spaces', () => {
        console.log('[Test] Rejecting multiple spaces');
        const result = validateBranchName('feature  branch');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Branch name cannot contain spaces');
      });
    });

    describe('invalid branch names - leading characters', () => {
      it('should reject leading dot', () => {
        console.log('[Test] Rejecting leading dot');
        const result = validateBranchName('.feature');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Branch name cannot start with a dot or hyphen');
      });

      it('should reject leading hyphen', () => {
        console.log('[Test] Rejecting leading hyphen');
        const result = validateBranchName('-feature');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Branch name cannot start with a dot or hyphen');
      });
    });

    describe('invalid branch names - .lock suffix', () => {
      it('should reject .lock suffix', () => {
        console.log('[Test] Rejecting .lock suffix');
        const result = validateBranchName('feature.lock');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Branch name cannot end with .lock');
      });

      it('should reject .lock with path', () => {
        console.log('[Test] Rejecting .lock with path');
        const result = validateBranchName('feature/branch.lock');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Branch name cannot end with .lock');
      });
    });

    describe('invalid branch names - special characters', () => {
      it('should reject tilde (~)', () => {
        console.log('[Test] Rejecting tilde character');
        const result = validateBranchName('feature~branch');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('invalid characters');
      });

      it('should reject caret (^)', () => {
        console.log('[Test] Rejecting caret character');
        const result = validateBranchName('feature^branch');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('invalid characters');
      });

      it('should reject colon (:)', () => {
        console.log('[Test] Rejecting colon character');
        const result = validateBranchName('feature:branch');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('invalid characters');
      });

      it('should reject question mark (?)', () => {
        console.log('[Test] Rejecting question mark');
        const result = validateBranchName('feature?branch');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('invalid characters');
      });

      it('should reject asterisk (*)', () => {
        console.log('[Test] Rejecting asterisk');
        const result = validateBranchName('feature*branch');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('invalid characters');
      });

      it('should reject square bracket ([)', () => {
        console.log('[Test] Rejecting square bracket');
        const result = validateBranchName('feature[branch');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('invalid characters');
      });

      it('should reject backslash (\\)', () => {
        console.log('[Test] Rejecting backslash');
        const result = validateBranchName('feature\\branch');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('invalid characters');
      });

      it('should reject control characters', () => {
        console.log('[Test] Rejecting control characters');
        const result = validateBranchName('feature\x00branch');

        expect(result.valid).toBe(false);
        expect(result.error).toContain('invalid characters');
      });
    });

    describe('invalid branch names - @{ sequence', () => {
      it('should reject @{ sequence', () => {
        console.log('[Test] Rejecting @{ sequence');
        const result = validateBranchName('feature@{branch');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Branch name cannot contain @{');
      });

      it('should reject @{ at start', () => {
        console.log('[Test] Rejecting @{ at start');
        const result = validateBranchName('@{feature');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Branch name cannot contain @{');
      });
    });
  });

  describe('isValidBranchName', () => {
    it('should return true for valid names', () => {
      console.log('[Test] Returning true for valid name');
      expect(isValidBranchName('feature')).toBe(true);
      expect(isValidBranchName('feature/branch')).toBe(true);
      expect(isValidBranchName('my-feature')).toBe(true);
    });

    it('should return false for invalid names', () => {
      console.log('[Test] Returning false for invalid names');
      expect(isValidBranchName('')).toBe(false);
      expect(isValidBranchName('/feature')).toBe(false);
      expect(isValidBranchName('feature/')).toBe(false);
      expect(isValidBranchName('feature branch')).toBe(false);
      expect(isValidBranchName('.feature')).toBe(false);
      expect(isValidBranchName('feature.lock')).toBe(false);
    });

    it('should be a convenience wrapper for validateBranchName', () => {
      console.log('[Test] Verifying isValidBranchName is a wrapper');
      const testCases = [
        'valid',
        'invalid@{',
        'feature/branch',
        '/invalid',
        'feature.lock',
        'my-feature',
      ];

      testCases.forEach((name) => {
        const validateResult = validateBranchName(name).valid;
        const isValidResult = isValidBranchName(name);
        expect(isValidResult).toBe(validateResult);
      });
    });
  });

  describe('sanitizeBranchName', () => {
    it('should replace spaces with hyphens', () => {
      console.log('[Test] Replacing spaces with hyphens');
      const result = sanitizeBranchName('feature branch');
      expect(result).toBe('feature-branch');
    });

    it('should replace multiple spaces with single hyphen', () => {
      console.log('[Test] Replacing multiple spaces');
      const result = sanitizeBranchName('feature   branch');
      expect(result).toBe('feature-branch');
    });

    it('should remove invalid characters', () => {
      console.log('[Test] Removing invalid characters');
      expect(sanitizeBranchName('feature~branch')).toBe('featurebranch');
      expect(sanitizeBranchName('feature^branch')).toBe('featurebranch');
      expect(sanitizeBranchName('feature:branch')).toBe('featurebranch');
      expect(sanitizeBranchName('feature?branch')).toBe('featurebranch');
      expect(sanitizeBranchName('feature*branch')).toBe('featurebranch');
      expect(sanitizeBranchName('feature[branch')).toBe('featurebranch');
      expect(sanitizeBranchName('feature\\branch')).toBe('featurebranch');
    });

    it('should remove @{ sequence', () => {
      console.log('[Test] Removing @{ sequence');
      const result = sanitizeBranchName('feature@{branch');
      expect(result).toBe('featurebranch');
    });

    it('should remove consecutive slashes', () => {
      console.log('[Test] Removing consecutive slashes');
      const result = sanitizeBranchName('feature//branch');
      expect(result).toBe('feature/branch');
    });

    it('should remove leading and trailing slashes', () => {
      console.log('[Test] Removing leading and trailing slashes');
      expect(sanitizeBranchName('/feature')).toBe('feature');
      expect(sanitizeBranchName('feature/')).toBe('feature');
      expect(sanitizeBranchName('/feature/')).toBe('feature');
    });

    it('should remove leading dots and hyphens', () => {
      console.log('[Test] Removing leading dots and hyphens');
      expect(sanitizeBranchName('.feature')).toBe('feature');
      expect(sanitizeBranchName('-feature')).toBe('feature');
      expect(sanitizeBranchName('.-feature')).toBe('feature');
    });

    it('should remove .lock suffix', () => {
      console.log('[Test] Removing .lock suffix');
      const result = sanitizeBranchName('feature.lock');
      expect(result).toBe('feature');
    });

    it('should trim whitespace', () => {
      console.log('[Test] Trimming whitespace');
      const result = sanitizeBranchName('  feature  ');
      expect(result).toBe('feature');
    });

    it('should handle complex sanitization', () => {
      console.log('[Test] Handling complex sanitization');
      const result = sanitizeBranchName('  .feature branch~test//path/.lock  ');
      expect(result).toBe('feature-branchtest/path/');
    });

    it('should preserve valid characters', () => {
      console.log('[Test] Preserving valid characters');
      const result = sanitizeBranchName('feature_branch-123');
      expect(result).toBe('feature_branch-123');
    });

    it('should handle already valid names', () => {
      console.log('[Test] Handling already valid names');
      expect(sanitizeBranchName('feature')).toBe('feature');
      expect(sanitizeBranchName('feature/branch')).toBe('feature/branch');
      expect(sanitizeBranchName('my-feature')).toBe('my-feature');
    });

    it('should produce valid branch names', () => {
      console.log('[Test] Producing valid branch names from sanitization');
      const invalidNames = [
        'feature branch',
        '/feature',
        'feature/',
        '.feature',
        'feature.lock',
        'feature~test',
        'feature@{branch',
      ];

      invalidNames.forEach((name) => {
        const sanitized = sanitizeBranchName(name);
        if (sanitized.length > 0) {
          expect(isValidBranchName(sanitized)).toBe(true);
        }
      });
    });
  });

  describe('edge cases', () => {
    it('should handle very long branch names', () => {
      console.log('[Test] Handling very long branch names');
      const longName = 'feature/' + 'a'.repeat(200);
      const result = validateBranchName(longName);
      expect(result.valid).toBe(true);
    });

    it('should handle unicode characters', () => {
      console.log('[Test] Handling unicode characters');
      const unicodeName = 'feature/你好';
      const result = validateBranchName(unicodeName);
      expect(result.valid).toBe(true);
    });

    it('should handle emoji in branch names', () => {
      console.log('[Test] Handling emoji in branch names');
      const emojiName = 'feature/🚀-test';
      const result = validateBranchName(emojiName);
      expect(result.valid).toBe(true);
    });

    it('should handle single character names', () => {
      console.log('[Test] Handling single character names');
      const result = validateBranchName('a');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('a');
    });

    it('should handle numbers-only names', () => {
      console.log('[Test] Handling numbers-only names');
      const result = validateBranchName('123');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('123');
    });
  });

  describe('integration with real-world branch names', () => {
    it('should accept common Git flow branches', () => {
      console.log('[Test] Accepting Git flow branches');
      const gitFlowBranches = [
        'main',
        'develop',
        'feature/user-authentication',
        'bugfix/login-error',
        'hotfix/critical-security-patch',
        'release/v1.2.0',
      ];

      gitFlowBranches.forEach((branch) => {
        expect(isValidBranchName(branch)).toBe(true);
      });
    });

    it('should accept ticket-based branch names', () => {
      console.log('[Test] Accepting ticket-based branch names');
      const ticketBranches = [
        'JIRA-123',
        'NOTCH-1464',
        'feature/PROJ-456-add-feature',
        'bugfix/TICKET-789-fix-issue',
      ];

      ticketBranches.forEach((branch) => {
        expect(isValidBranchName(branch)).toBe(true);
      });
    });

    it('should sanitize user-provided names', () => {
      console.log('[Test] Sanitizing user-provided names');
      const userInputs = [
        { input: 'My Feature Branch', expected: 'My-Feature-Branch' },
        { input: 'feature: new test', expected: 'feature-new-test' },
        { input: 'fix/bug #123', expected: 'fix/bug-123' },
      ];

      userInputs.forEach(({ input }) => {
        const sanitized = sanitizeBranchName(input);
        expect(isValidBranchName(sanitized)).toBe(true);
      });
    });
  });
});
