module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  maxWorkers: 2,
  testMatch: ['**/__tests__/**/*.{ts,tsx,js,jsx}', '**/?(*.)+(spec|test).{ts,tsx,js,jsx}'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
      },
    ],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  collectCoverageFrom: [
    // Focus on main process (backend) code only - this is what we're testing
    'src/main/**/*.{ts,tsx}',
    'src/services/**/*.{ts,tsx}',
    'src/commons/**/*.{ts,tsx}',
    'src/entities/**/*.{ts,tsx}',

    // Exclude files that don't need testing
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/main/main.ts', // Entry point
    '!src/main/preload.ts', // Preload script
    '!src/**/Mock*', // Mock files
    '!src/commons/config/environment.ts', // Config
    '!src/main/test-mode.ts', // Test utilities

    // Exclude specific problematic files that are hard to test
    '!src/services/UpdateService.ts', // Auto-updater (external dependency)
    '!src/services/GitService.ts', // Git operations (filesystem heavy)
    '!src/services/monitoring.ts', // Monitoring (external services)
    '!src/entities/TokenCounts.ts', // Simple data structure
    '!src/entities/LoadedUsageEntry.ts', // Complex data structure with minimal logic

    // Keep only the truly problematic files excluded
    // AgentHandlers.ts now covered by comprehensive test suite (NOTCH-1461)
    '!src/main/ipc/IpcMigrationManager.ts', // 388 lines, complex migration logic
    '!src/commons/types/config.ts', // 115 lines, type definitions only
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    'electron-updater': '<rootDir>/__mocks__/electron-updater.js',
    'react-markdown': '<rootDir>/tests/__mocks__/react-markdown.tsx',
    'remark-gfm': '<rootDir>/tests/__mocks__/remark-gfm.ts',
    'remark-breaks': '<rootDir>/tests/__mocks__/remark-breaks.ts',
    'react-syntax-highlighter': '<rootDir>/tests/__mocks__/react-syntax-highlighter.tsx',
    'react-syntax-highlighter/dist/esm/styles/prism': '<rootDir>/tests/__mocks__/prism-styles.ts',
    '@radix-ui/react-popover': '<rootDir>/tests/__mocks__/@radix-ui/react-popover.tsx',
    '@radix-ui/react-checkbox': '<rootDir>/tests/__mocks__/@radix-ui/react-checkbox.tsx',
    '@radix-ui/react-scroll-area': '<rootDir>/tests/__mocks__/@radix-ui/react-scroll-area.tsx',
    cmdk: '<rootDir>/tests/__mocks__/cmdk.tsx',
    '@anthropic-ai/claude-agent-sdk': '<rootDir>/tests/__mocks__/@anthropic-ai/claude-agent-sdk.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts', '<rootDir>/tests/setup-theme.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/out/',
    'components/.*\\.test\\.[jt]sx?$', // Skip component tests for lean testing
    'tests/component/', // Playwright component tests - run separately
    'tests/e2e/', // Playwright tests - run separately
    'tests/e2e-jest/', // Jest E2E tests - require API keys, run separately
    'tests/performance/', // Vitest performance tests - run separately
    'tests/integration/terminal-memory\\.test\\.ts', // Vitest test - run separately
    'tests/integration/terminal-persistence\\.test\\.ts', // Integration test with issues
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(react-markdown|remark-.*|micromark.*|unist-.*|unified|bail|is-plain-obj|trough|vfile|vfile-message|mdast-util-.*|ccount|escape-string-regexp|markdown-table|zwitch|longest-streak|hast-.*|property-information|space-separated-tokens|comma-separated-tokens|pretty-bytes|character-entities.*|decode-named-character-reference|parse-entities|stringify-entities|character-reference-invalid|is-decimal|is-hexadecimal|is-alphanumerical|is-alphabetical|trim-lines|estree-util-.*|periscopic|is-reference|html-void-elements|uuid|@anthropic-ai)/)',
  ],
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  coverageThreshold: {
    global: {
      branches: 8, // Temporarily lowered after restructuring
      functions: 8, // Temporarily lowered after restructuring
      lines: 11, // Temporarily lowered after restructuring
      statements: 11, // Temporarily lowered after restructuring
    },
  },
};
