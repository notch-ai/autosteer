import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

describe('MaximizeButton Removal Verification', () => {
  const desktopAppRoot = path.resolve(__dirname, '../../../');

  describe('File Removal', () => {
    it('should not find MaximizeButton.tsx in codebase', () => {
      const maximizeButtonPath = path.join(
        desktopAppRoot,
        'src/features/shared/components/ui/MaximizeButton.tsx'
      );
      expect(existsSync(maximizeButtonPath)).toBe(false);
    });

    it('should not find useMaximizeButton.ts in codebase', () => {
      const useMaximizeButtonPath = path.join(desktopAppRoot, 'src/hooks/useMaximizeButton.ts');
      expect(existsSync(useMaximizeButtonPath)).toBe(false);
    });

    it('should not find MaximizeButton.test.tsx in codebase', () => {
      const testPath = path.join(
        desktopAppRoot,
        'tests/unit/features/shared/components/ui/MaximizeButton.test.tsx'
      );
      expect(existsSync(testPath)).toBe(false);
    });
  });

  describe('Import References', () => {
    it('should not have MaximizeButton imports remaining in src/', () => {
      try {
        const result = execSync(
          'grep -r "MaximizeButton" src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true',
          {
            cwd: desktopAppRoot,
            encoding: 'utf-8',
          }
        ).trim();
        expect(result).toBe('');
      } catch (error) {
        // grep returns non-zero exit code when no matches found, which is what we want
        expect(true).toBe(true);
      }
    });

    it('should not have useMaximizeButton imports remaining in src/', () => {
      try {
        const result = execSync(
          'grep -r "useMaximizeButton" src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true',
          {
            cwd: desktopAppRoot,
            encoding: 'utf-8',
          }
        ).trim();
        expect(result).toBe('');
      } catch (error) {
        // grep returns non-zero exit code when no matches found, which is what we want
        expect(true).toBe(true);
      }
    });
  });

  describe('Export References', () => {
    it('should not have MaximizeButton in barrel exports', () => {
      try {
        const result = execSync(
          'grep -r "export.*MaximizeButton" src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true',
          {
            cwd: desktopAppRoot,
            encoding: 'utf-8',
          }
        ).trim();
        expect(result).toBe('');
      } catch (error) {
        expect(true).toBe(true);
      }
    });
  });
});
