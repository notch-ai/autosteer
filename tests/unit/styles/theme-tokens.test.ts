import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as postcss from 'postcss';

const CSS_FILE_PATH = resolve(__dirname, '../../../src/styles/tailwind-tokens.css');

function parseCSSFile(content: string): postcss.Root {
  return postcss.parse(content);
}

function extractRuleSelectors(root: postcss.Root): string[] {
  const selectors: string[] = [];
  root.walkRules((rule) => {
    selectors.push(rule.selector);
  });
  return selectors;
}

function extractDeclarationsFromRule(root: postcss.Root, selector: string): Map<string, string> {
  const declarations = new Map<string, string>();
  root.walkRules(selector, (rule) => {
    rule.walkDecls((decl) => {
      declarations.set(decl.prop, decl.value);
    });
  });
  return declarations;
}

function isRGBTriplet(value: string): boolean {
  const rgbPattern = /^\d+\s+\d+\s+\d+$/;
  return rgbPattern.test(value.trim());
}

function isHSL(value: string): boolean {
  const hslPattern = /\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%/;
  return hslPattern.test(value);
}

describe('Theme Token System', () => {
  let cssContent: string;
  let cssRoot: postcss.Root;

  beforeAll(() => {
    cssContent = readFileSync(CSS_FILE_PATH, 'utf-8');
    cssRoot = parseCSSFile(cssContent);
  });

  describe('Theme Class Structure', () => {
    it('should define .theme-night class', () => {
      const selectors = extractRuleSelectors(cssRoot);
      expect(selectors).toContain('.theme-night');
    });

    it('should define .theme-day class', () => {
      const selectors = extractRuleSelectors(cssRoot);
      expect(selectors).toContain('.theme-day');
    });
  });

  describe('.theme-night RGB Token Definitions', () => {
    const requiredTokens = [
      '--background',
      '--foreground',
      '--card',
      '--card-foreground',
      '--popover',
      '--popover-foreground',
      '--primary',
      '--primary-foreground',
      '--secondary',
      '--secondary-foreground',
      '--muted',
      '--muted-foreground',
      '--accent',
      '--accent-foreground',
      '--destructive',
      '--destructive-foreground',
      '--border',
      '--input',
      '--ring',
    ];

    it('should define all 19 shadcn tokens in .theme-night', () => {
      const declarations = extractDeclarationsFromRule(cssRoot, '.theme-night');

      requiredTokens.forEach((token) => {
        expect(declarations.has(token)).toBe(true);
      });

      expect(declarations.size).toBeGreaterThanOrEqual(requiredTokens.length);
    });

    it('should use RGB triplet format for all color tokens in .theme-night', () => {
      const declarations = extractDeclarationsFromRule(cssRoot, '.theme-night');

      requiredTokens.forEach((token) => {
        const value = declarations.get(token);
        expect(value).toBeDefined();
        expect(isRGBTriplet(value!)).toBe(true);
      });
    });

    it('should not use HSL format in .theme-night', () => {
      const declarations = extractDeclarationsFromRule(cssRoot, '.theme-night');

      requiredTokens.forEach((token) => {
        const value = declarations.get(token);
        expect(value).toBeDefined();
        expect(isHSL(value!)).toBe(false);
      });
    });
  });

  describe('.theme-day RGB Token Definitions', () => {
    const requiredTokens = [
      '--background',
      '--foreground',
      '--card',
      '--card-foreground',
      '--popover',
      '--popover-foreground',
      '--primary',
      '--primary-foreground',
      '--secondary',
      '--secondary-foreground',
      '--muted',
      '--muted-foreground',
      '--accent',
      '--accent-foreground',
      '--destructive',
      '--destructive-foreground',
      '--border',
      '--input',
      '--ring',
    ];

    it('should define all 19 shadcn tokens in .theme-day', () => {
      const declarations = extractDeclarationsFromRule(cssRoot, '.theme-day');

      requiredTokens.forEach((token) => {
        expect(declarations.has(token)).toBe(true);
      });

      expect(declarations.size).toBeGreaterThanOrEqual(requiredTokens.length);
    });

    it('should use RGB triplet format for all color tokens in .theme-day', () => {
      const declarations = extractDeclarationsFromRule(cssRoot, '.theme-day');

      requiredTokens.forEach((token) => {
        const value = declarations.get(token);
        expect(value).toBeDefined();
        expect(isRGBTriplet(value!)).toBe(true);
      });
    });

    it('should not use HSL format in .theme-day', () => {
      const declarations = extractDeclarationsFromRule(cssRoot, '.theme-day');

      requiredTokens.forEach((token) => {
        const value = declarations.get(token);
        expect(value).toBeDefined();
        expect(isHSL(value!)).toBe(false);
      });
    });
  });

  describe(':root Active Color Assignments', () => {
    const activeColorTokens = [
      '--background',
      '--foreground',
      '--card',
      '--card-foreground',
      '--popover',
      '--popover-foreground',
      '--primary',
      '--primary-foreground',
      '--secondary',
      '--secondary-foreground',
      '--muted',
      '--muted-foreground',
      '--accent',
      '--accent-foreground',
      '--destructive',
      '--destructive-foreground',
      '--border',
      '--input',
      '--ring',
    ];

    it('should not have :root active color assignments', () => {
      const declarations = extractDeclarationsFromRule(cssRoot, ':root');

      activeColorTokens.forEach((token) => {
        const value = declarations.get(token);
        if (value !== undefined) {
          expect(value.includes('var(--night-')).toBe(false);
          expect(value.includes('var(--day-')).toBe(false);
        }
      });
    });
  });

  describe('RGB Format Validation', () => {
    it('should convert all HSL values to RGB triplets in theme classes', () => {
      const nightDeclarations = extractDeclarationsFromRule(cssRoot, '.theme-night');
      const dayDeclarations = extractDeclarationsFromRule(cssRoot, '.theme-day');

      nightDeclarations.forEach((value, key) => {
        if (
          key.startsWith('--background') ||
          key.startsWith('--foreground') ||
          key.startsWith('--card') ||
          key.startsWith('--popover') ||
          key.startsWith('--primary') ||
          key.startsWith('--secondary') ||
          key.startsWith('--muted') ||
          key.startsWith('--accent') ||
          key.startsWith('--destructive') ||
          key === '--border' ||
          key === '--input' ||
          key === '--ring'
        ) {
          expect(isHSL(value)).toBe(false);
          expect(isRGBTriplet(value)).toBe(true);
        }
      });

      dayDeclarations.forEach((value, key) => {
        if (
          key.startsWith('--background') ||
          key.startsWith('--foreground') ||
          key.startsWith('--card') ||
          key.startsWith('--popover') ||
          key.startsWith('--primary') ||
          key.startsWith('--secondary') ||
          key.startsWith('--muted') ||
          key.startsWith('--accent') ||
          key.startsWith('--destructive') ||
          key === '--border' ||
          key === '--input' ||
          key === '--ring'
        ) {
          expect(isHSL(value)).toBe(false);
          expect(isRGBTriplet(value)).toBe(true);
        }
      });
    });
  });
});
