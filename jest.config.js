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
    'src/hooks/**/*Handler.{ts,tsx}', // Handler pattern hooks 

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
    // AgentHandlers.ts now covered by comprehensive test suite
    '!src/main/ipc/IpcMigrationManager.ts', // 388 lines, complex migration logic
    '!src/commons/types/config.ts', // 115 lines, type definitions only
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^electron$': '<rootDir>/__mocks__/electron.js',
    'electron-log': '<rootDir>/__mocks__/electron-log.ts',
    'electron-log/renderer': '<rootDir>/__mocks__/electron-log/renderer.ts',
    'electron-store': '<rootDir>/__mocks__/electron-store.js',
    'electron-updater': '<rootDir>/__mocks__/electron-updater.js',
    'parse-diff': '<rootDir>/__mocks__/parse-diff.ts',
    'simple-git': '<rootDir>/__mocks__/simple-git.ts',
    '@anthropic-ai/sdk': '<rootDir>/__mocks__/@anthropic-ai/sdk.ts',
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
    chokidar: '<rootDir>/tests/__mocks__/chokidar.ts',
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
    'tests/unit/main/ipc/handlers/project\\.handlers\\.test\\.ts', // TODO: Fix electron mock setup
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(react-markdown|remark-.*|micromark.*|unist-.*|unified|bail|is-plain-obj|trough|vfile|vfile-message|mdast-util-.*|ccount|escape-string-regexp|markdown-table|zwitch|longest-streak|hast-.*|property-information|space-separated-tokens|comma-separated-tokens|pretty-bytes|character-entities.*|decode-named-character-reference|parse-entities|stringify-entities|character-reference-invalid|is-decimal|is-hexadecimal|is-alphanumerical|is-alphabetical|trim-lines|estree-util-.*|periscopic|is-reference|html-void-elements|uuid|@anthropic-ai|zustand)/)',
  ],
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  coverageThreshold: {
    global: {
      branches: 35, // Raised to match actual coverage
      functions: 50, // Raised to match actual coverage
      lines: 45, // Raised to match actual coverage
      statements: 45, // Raised to match actual coverage
    },
    // Handler-specific coverage requirements
    // Set to current achieved levels, gradually increase as more tests added
    'src/hooks/useChatInputHandler.ts': {
      branches: 87,
      functions: 100,
      lines: 98,
      statements: 99,
    },
    'src/hooks/useTerminalTabHandler.ts': {
      branches: 75,
      functions: 57,
      lines: 84,
      statements: 84,
    },
    'src/hooks/useDiffViewerHandler.ts': {
      branches: 96,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    'src/hooks/useSidebarHandler.ts': {
      branches: 75,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    'src/hooks/useTaskListHandler.ts': {
      branches: 78,
      functions: 100,
      lines: 95,
      statements: 96,
    },
  },
};
