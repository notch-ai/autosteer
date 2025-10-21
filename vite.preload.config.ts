import { defineConfig, createLogger } from 'vite';
import path from 'path';

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
      entry: 'src/main/preload.ts',
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    rollupOptions: {
      external: ['electron'],
      output: {
        entryFileNames: 'preload.js',
      },
    },
    sourcemap: true,
    minify: process.env.NODE_ENV === 'production',
    emptyOutDir: false,
    target: 'chrome114', // Electron 28 Chromium version
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
