import { execSync } from 'child_process';
import * as path from 'path';

describe('Hardcoded Color Elimination', () => {
  const srcDir = path.join(__dirname, '../../../src');

  it('should not contain hex color literals in component files', () => {
    try {
      const result = execSync(
        `grep -rE '#[0-9a-fA-F]{3,6}' ${srcDir} --include="*.tsx" --include="*.ts" | grep -v "test" | grep -v "stories" | grep -v "TerminalLibraryAdapter" | grep -v "XtermTerminal" | grep -v "editor/theme"`,
        { encoding: 'utf-8' }
      );

      // Filter out allowed files that have legitimate hex colors (terminal themes, etc.)
      const lines = result.split('\n').filter((line) => line.trim());
      const disallowedLines = lines.filter((line) => {
        // Allow terminal color configurations
        if (line.includes('TerminalLibraryAdapter.ts')) return false;
        if (line.includes('XtermTerminal.tsx')) return false;
        if (line.includes('editor/theme.ts')) return false;
        return true;
      });

      if (disallowedLines.length > 0) {
        throw new Error(
          `Found ${disallowedLines.length} hex color literals in component files:\n${disallowedLines.join('\n')}`
        );
      }
    } catch (error: any) {
      // grep returns exit code 1 when no matches found (which is what we want)
      if (error.status !== 1) {
        throw error;
      }
    }
  });

  it('should not contain rgb() literals in component files', () => {
    try {
      const result = execSync(
        `grep -rE 'rgb\\(|rgba\\(' ${srcDir} --include="*.tsx" --include="*.ts" | grep -v "test" | grep -v "stories" | grep -v "TerminalLibraryAdapter" | grep -v "XtermTerminal" | grep -v "editor/theme"`,
        { encoding: 'utf-8' }
      );

      const lines = result.split('\n').filter((line) => line.trim());
      const disallowedLines = lines.filter((line) => {
        // Allow terminal color configurations and CSS variable references
        if (line.includes('TerminalLibraryAdapter.ts')) return false;
        if (line.includes('XtermTerminal.tsx')) return false;
        if (line.includes('editor/theme.ts')) return false;
        if (line.includes('rgb(var(--')) return false; // Allow CSS variable usage
        return true;
      });

      if (disallowedLines.length > 0) {
        throw new Error(
          `Found ${disallowedLines.length} rgb() literals in component files:\n${disallowedLines.join('\n')}`
        );
      }
    } catch (error: any) {
      // grep returns exit code 1 when no matches found (which is what we want)
      if (error.status !== 1) {
        throw error;
      }
    }
  });

  describe('Sidebar Component', () => {
    it('should not have hardcoded colors in TaskIndicator', () => {
      try {
        const result = execSync(
          `grep -n "backgroundColor.*#" ${path.join(srcDir, 'features/shared/components/layout/Sidebar.tsx')}`,
          { encoding: 'utf-8' }
        );
        throw new Error(`Found hardcoded backgroundColor in Sidebar.tsx:\n${result}`);
      } catch (error: any) {
        // grep returns exit code 1 when no matches found (which is what we want)
        if (error.status !== 1) {
          throw error;
        }
      }
    });
  });

  describe('ResizablePanel Component', () => {
    it('should not have hardcoded rgb colors in resize indicator', () => {
      try {
        const result = execSync(
          `grep -n "rgb(59 130 246" ${path.join(srcDir, 'features/shared/components/layout/ResizablePanel.tsx')}`,
          { encoding: 'utf-8' }
        );
        throw new Error(`Found hardcoded rgb color in ResizablePanel.tsx:\n${result}`);
      } catch (error: any) {
        // grep returns exit code 1 when no matches found (which is what we want)
        if (error.status !== 1) {
          throw error;
        }
      }
    });
  });

  describe('ProjectList Component', () => {
    it('should not have hardcoded hex colors in StatusIcon', () => {
      try {
        const result = execSync(
          `grep -n "return '#" ${path.join(srcDir, 'features/shared/components/projects/ProjectList.tsx')}`,
          { encoding: 'utf-8' }
        );
        throw new Error(`Found hardcoded hex color in ProjectList.tsx:\n${result}`);
      } catch (error: any) {
        // grep returns exit code 1 when no matches found (which is what we want)
        if (error.status !== 1) {
          throw error;
        }
      }
    });

    it('should not have rgb() color literals', () => {
      try {
        const result = execSync(
          `grep -n "rgb(var(" ${path.join(srcDir, 'features/shared/components/projects/ProjectList.tsx')}`,
          { encoding: 'utf-8' }
        );
        throw new Error(`Found rgb(var() usage in ProjectList.tsx:\n${result}`);
      } catch (error: any) {
        // grep returns exit code 1 when no matches found (which is what we want)
        if (error.status !== 1) {
          throw error;
        }
      }
    });
  });
});
