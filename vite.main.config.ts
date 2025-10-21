import { defineConfig, createLogger } from 'vite';
import path from 'path';
import { builtinModules } from 'module';

// Create custom logger with 24-hour timestamp format
const customLogger = createLogger();
const originalInfo = customLogger.info;
const originalWarn = customLogger.warn;
const originalError = customLogger.error;

const formatTime = () => {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  const s = now.getSeconds().toString().padStart(2, '0');
  return `[${h}:${m}:${s}]`;
};

customLogger.info = (msg, options) => {
  originalInfo(`${formatTime()} ${msg}`, options);
};
customLogger.warn = (msg, options) => {
  originalWarn(`${formatTime()} ${msg}`, options);
};
customLogger.error = (msg, options) => {
  originalError(`${formatTime()} ${msg}`, options);
};

export default defineConfig({
  customLogger,
  root: __dirname,
  mode: process.env.NODE_ENV || 'development',

  build: {
    outDir: '.vite/build',
    lib: {
      entry: 'src/main/main.ts',
      formats: ['cjs'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: [
        'electron',
        'electron-squirrel-startup',
        'node-pty',
        '@anthropic-ai/sdk',
        '@anthropic-ai/claude-agent-sdk',
        'fix-path',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      output: {
        entryFileNames: 'main.js',
      },
    },
    sourcemap: true,
    minify: process.env.NODE_ENV === 'production',
    emptyOutDir: false,
    reportCompressedSize: false,
    target: 'node20',
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@main': path.resolve(__dirname, './src/main'),
      '@common': path.resolve(__dirname, './src/common'),
    },
  },

  optimizeDeps: {
    exclude: ['node-pty', '@anthropic-ai/sdk', '@anthropic-ai/claude-agent-sdk'],
  },
});
