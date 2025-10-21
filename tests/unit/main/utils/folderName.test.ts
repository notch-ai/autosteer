import { convertToFolderName } from '@/main/utils/folderName';

describe('convertToFolderName', () => {
  describe('SSH URL format', () => {
    it('should handle standard SSH format with .git extension', () => {
      const result = convertToFolderName('git@github.com:user/repo.git', 'main');
      expect(result).toBe('repo-main');
    });

    it('should handle SSH format without .git extension', () => {
      const result = convertToFolderName('git@github.com:user/repo', 'develop');
      expect(result).toBe('repo-develop');
    });

    it('should handle SSH format with organization', () => {
      const result = convertToFolderName('git@github.com:org/my-project.git', 'feature/test');
      expect(result).toBe('my-project-test');
    });

    it('should handle GitLab SSH format', () => {
      const result = convertToFolderName('git@gitlab.com:user/repo.git', 'master');
      expect(result).toBe('repo-master');
    });

    it('should handle Bitbucket SSH format', () => {
      const result = convertToFolderName('git@bitbucket.org:user/repo.git', 'staging');
      expect(result).toBe('repo-staging');
    });

    it('should handle SSH format with port', () => {
      const result = convertToFolderName('ssh://git@github.com:22/user/repo.git', 'main');
      expect(result).toBe('repo-main');
    });
  });

  describe('HTTPS URL format', () => {
    it('should handle standard HTTPS format with .git extension', () => {
      const result = convertToFolderName('https://github.com/user/repo.git', 'main');
      expect(result).toBe('repo-main');
    });

    it('should handle HTTPS format without .git extension', () => {
      const result = convertToFolderName('https://github.com/user/repo', 'develop');
      expect(result).toBe('repo-develop');
    });

    it('should handle HTTPS with credentials', () => {
      const result = convertToFolderName('https://user:token@github.com/org/repo.git', 'main');
      expect(result).toBe('repo-main');
    });

    it('should handle GitLab HTTPS format', () => {
      const result = convertToFolderName('https://gitlab.com/user/repo.git', 'master');
      expect(result).toBe('repo-master');
    });

    it('should handle Bitbucket HTTPS format', () => {
      const result = convertToFolderName('https://bitbucket.org/user/repo.git', 'staging');
      expect(result).toBe('repo-staging');
    });

    it('should handle custom domain HTTPS', () => {
      const result = convertToFolderName('https://git.company.com/team/project.git', 'release');
      expect(result).toBe('project-release');
    });
  });

  describe('Branch name handling', () => {
    it('should extract last part of nested branch name', () => {
      const result = convertToFolderName('git@github.com:user/repo.git', 'feature/auth/login');
      expect(result).toBe('repo-login');
    });

    it('should handle branch names with special characters', () => {
      const result = convertToFolderName('git@github.com:user/repo.git', 'feature/JIRA-123');
      expect(result).toBe('repo-jira-123');
    });

    it('should handle branch names with underscores', () => {
      const result = convertToFolderName('git@github.com:user/repo.git', 'feature/new_feature');
      expect(result).toBe('repo-new-feature');
    });

    it('should handle branch names with dots', () => {
      const result = convertToFolderName('git@github.com:user/repo.git', 'release/v1.2.3');
      expect(result).toBe('repo-v1-2-3');
    });

    it('should handle single-level branch names', () => {
      const result = convertToFolderName('git@github.com:user/repo.git', 'main');
      expect(result).toBe('repo-main');
    });

    it('should handle branch names with multiple slashes', () => {
      const result = convertToFolderName(
        'git@github.com:user/repo.git',
        'feature/team/member/task'
      );
      expect(result).toBe('repo-task');
    });
  });

  describe('Repository name handling', () => {
    it('should handle repo names with hyphens', () => {
      const result = convertToFolderName('git@github.com:user/my-awesome-repo.git', 'main');
      expect(result).toBe('my-awesome-repo-main');
    });

    it('should handle repo names with underscores', () => {
      const result = convertToFolderName('git@github.com:user/my_awesome_repo.git', 'main');
      expect(result).toBe('my-awesome-repo-main');
    });

    it('should handle repo names with dots', () => {
      const result = convertToFolderName('git@github.com:user/my.awesome.repo.git', 'main');
      expect(result).toBe('my-awesome-repo-main');
    });

    it('should handle repo names with numbers', () => {
      const result = convertToFolderName('git@github.com:user/repo123.git', 'main');
      expect(result).toBe('repo123-main');
    });

    it('should handle repo names with uppercase letters', () => {
      const result = convertToFolderName('git@github.com:user/MyRepo.git', 'main');
      expect(result).toBe('myrepo-main');
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed URLs by using full URL', () => {
      const result = convertToFolderName('not-a-valid-url', 'main');
      expect(result).toBe('not-a-valid-url-main');
    });

    it('should handle empty branch name', () => {
      const result = convertToFolderName('git@github.com:user/repo.git', '');
      expect(result).toBe('repo');
    });

    it('should handle empty repo URL', () => {
      const result = convertToFolderName('', 'main');
      expect(result).toBe('main');
    });

    it('should handle both empty inputs', () => {
      const result = convertToFolderName('', '');
      expect(result).toBe('unnamed-worktree');
    });

    it('should handle URLs with trailing slashes', () => {
      const result = convertToFolderName('https://github.com/user/repo/', 'main');
      expect(result).toBe('repo-main');
    });

    it('should handle file:// protocol', () => {
      const result = convertToFolderName('file:///path/to/repo.git', 'main');
      expect(result).toBe('repo-main');
    });

    it('should handle local file paths', () => {
      const result = convertToFolderName('/path/to/local/repo.git', 'main');
      expect(result).toBe('repo-main');
    });

    it('should handle Windows file paths', () => {
      const result = convertToFolderName('C:\\path\\to\\repo.git', 'main');
      expect(result).toBe('repo-main');
    });
  });

  describe('Special character sanitization', () => {
    it('should replace multiple special characters with single hyphen', () => {
      const result = convertToFolderName('git@github.com:user/repo.git', 'feature/@#$%test');
      expect(result).toBe('repo-test');
    });

    it('should remove leading and trailing hyphens', () => {
      const result = convertToFolderName('git@github.com:user/---repo---.git', '---main---');
      expect(result).toBe('repo-main');
    });

    it('should collapse multiple consecutive hyphens', () => {
      const result = convertToFolderName('git@github.com:user/repo.git', 'feature///branch');
      expect(result).toBe('repo-branch');
    });

    it('should handle Unicode characters', () => {
      const result = convertToFolderName('git@github.com:user/repo.git', 'feature/café');
      expect(result).toBe('repo-caf');
    });

    it('should handle emoji in branch names', () => {
      const result = convertToFolderName('git@github.com:user/repo.git', 'feature/🚀-launch');
      expect(result).toBe('repo-launch');
    });

    it('should handle spaces in names', () => {
      const result = convertToFolderName('git@github.com:user/my repo.git', 'my branch');
      expect(result).toBe('my-repo-my-branch');
    });
  });

  describe('Complex scenarios', () => {
    it('should handle monorepo with nested path', () => {
      const result = convertToFolderName(
        'git@github.com:company/monorepo.git//packages/app',
        'feature/update'
      );
      expect(result).toBe('app-update');
    });

    it('should handle very long repo names', () => {
      const longName = 'a'.repeat(100);
      const result = convertToFolderName(`git@github.com:user/${longName}.git`, 'main');
      expect(result).toBe(`${longName}-main`);
    });

    it('should handle very long branch names', () => {
      const longBranch = 'feature/' + 'a'.repeat(100);
      const result = convertToFolderName('git@github.com:user/repo.git', longBranch);
      expect(result).toBe(`repo-${'a'.repeat(100)}`);
    });

    it('should handle mixed protocols and formats', () => {
      const urls = [
        'git@github.com:user/repo.git',
        'https://github.com/user/repo.git',
        'ssh://git@github.com/user/repo.git',
        'git://github.com/user/repo.git',
      ];
      const branch = 'main';

      urls.forEach((url) => {
        const result = convertToFolderName(url, branch);
        expect(result).toBe('repo-main');
      });
    });
  });
});
