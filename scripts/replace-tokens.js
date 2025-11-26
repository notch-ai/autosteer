#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

const TOKEN_MAP = {
  'text-text-muted': 'text-muted-foreground',
  'bg-button-special': 'bg-primary',
  'text-text': 'text-foreground',
  'bg-surface': 'bg-card',
};

function replaceTokens(content) {
  let result = content;

  Object.entries(TOKEN_MAP).forEach(([oldToken, newToken]) => {
    const regex = new RegExp(`\\b${oldToken}\\b`, 'g');
    result = result.replace(regex, newToken);
  });

  return result;
}

function replaceTokensInDirectory(baseDir, patterns) {
  const stats = {
    filesProcessed: 0,
    totalReplacements: 0,
    replacementsByToken: {},
  };

  Object.keys(TOKEN_MAP).forEach((token) => {
    stats.replacementsByToken[token] = 0;
  });

  const allFiles = [];
  patterns.forEach((pattern) => {
    const files = globSync(pattern, {
      cwd: baseDir,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/build/**'],
    });
    allFiles.push(...files);
  });

  allFiles.forEach((file) => {
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

      console.log(`✏️  ${path.relative(baseDir, file)}`);
    }
  });

  return stats;
}

function main() {
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

  const stats = replaceTokensInDirectory(baseDir, patterns);

  console.log('');
  console.log('✅ Token replacement complete!');
  console.log('');
  console.log('📊 Statistics:');
  console.log(`  Files processed: ${stats.filesProcessed}`);
  console.log(`  Total replacements: ${stats.totalReplacements}`);
  console.log('');
  console.log('📝 Replacements by token:');

  Object.entries(stats.replacementsByToken).forEach(([token, count]) => {
    if (count > 0) {
      console.log(`  ${token} → ${TOKEN_MAP[token]}: ${count}`);
    }
  });

  if (stats.filesProcessed === 0) {
    console.log('ℹ️  No files needed replacement.');
  }
}

main();
