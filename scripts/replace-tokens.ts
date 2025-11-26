#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const TOKEN_MAP = {
  'text-text-muted': 'text-muted-foreground',
  'bg-button-special': 'bg-primary',
  'text-text': 'text-foreground',
  'bg-surface': 'bg-card',
} as const;

interface ReplacementStats {
  filesProcessed: number;
  totalReplacements: number;
  replacementsByToken: Record<string, number>;
}

export function replaceTokens(content: string): string {
  let result = content;

  Object.entries(TOKEN_MAP).forEach(([oldToken, newToken]) => {
    const regex = new RegExp(`\\b${oldToken}\\b`, 'g');
    result = result.replace(regex, newToken);
  });

  return result;
}

export async function replaceTokensInFile(filePath: string): Promise<number> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const newContent = replaceTokens(content);

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf-8');

    let replacements = 0;
    Object.keys(TOKEN_MAP).forEach((oldToken) => {
      const regex = new RegExp(`\\b${oldToken}\\b`, 'g');
      const matches = content.match(regex);
      if (matches) {
        replacements += matches.length;
      }
    });

    return replacements;
  }

  return 0;
}

export async function replaceTokensInDirectory(
  baseDir: string,
  patterns: string[]
): Promise<ReplacementStats> {
  const stats: ReplacementStats = {
    filesProcessed: 0,
    totalReplacements: 0,
    replacementsByToken: {},
  };

  Object.keys(TOKEN_MAP).forEach((token) => {
    stats.replacementsByToken[token] = 0;
  });

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: baseDir,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/build/**'],
    });

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const newContent = replaceTokens(content);

      if (content !== newContent) {
        fs.writeFileSync(file, newContent, 'utf-8');
        stats.filesProcessed++;

        Object.keys(TOKEN_MAP).forEach((oldToken) => {
          const regex = new RegExp(`\\b${oldToken}\\b`, 'g');
          const matches = content.match(regex);
          if (matches) {
            stats.replacementsByToken[oldToken] += matches.length;
            stats.totalReplacements += matches.length;
          }
        });
      }
    }
  }

  return stats;
}

async function main() {
  const baseDir = path.resolve(__dirname, '..');
  const patterns = [
    'src/**/*.tsx',
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
    '!src/**/*.spec.ts',
    '!src/**/*.spec.tsx',
  ];

  console.log('🔍 Searching for files with legacy tokens...');
  console.log(`📁 Base directory: ${baseDir}`);
  console.log(`📝 Patterns: ${patterns.join(', ')}`);
  console.log('');

  const stats = await replaceTokensInDirectory(baseDir, patterns);

  console.log('✅ Token replacement complete!');
  console.log('');
  console.log('📊 Statistics:');
  console.log(`  Files processed: ${stats.filesProcessed}`);
  console.log(`  Total replacements: ${stats.totalReplacements}`);
  console.log('');
  console.log('📝 Replacements by token:');

  Object.entries(stats.replacementsByToken).forEach(([token, count]) => {
    if (count > 0) {
      console.log(`  ${token} → ${TOKEN_MAP[token as keyof typeof TOKEN_MAP]}: ${count}`);
    }
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}
