import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { builtinModules } from 'module';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

// Consolidated Vite configuration for all build targets
const isProduction = process.env.NODE_ENV === 'production';

// Shared configuration
const sharedConfig = {
  mode: process.env.NODE_ENV || 'development',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@features': path.resolve(__dirname, './src/renderer/features'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@services': path.resolve(__dirname, './src/services'),
      '@main': path.resolve(__dirname, './src/main'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@common': path.resolve(__dirname, './src/common'),
      '@commons': path.resolve(__dirname, './src/commons'),
      '@entities': path.resolve(__dirname, './src/entities'),
    },
  },
  build: {
    sourcemap: !isProduction,
    minify: isProduction ? ('esbuild' as const) : false,
    reportCompressedSize: false,
  },
};

// Main process config
export const mainConfig = defineConfig({
  ...sharedConfig,
  root: __dirname,
  build: {
    ...sharedConfig.build,
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
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      output: {
        entryFileNames: 'main.js',
      },
    },
    emptyOutDir: false,
    target: 'node20',
  },
});

// Preload config
export const preloadConfig = defineConfig({
  ...sharedConfig,
  root: __dirname,
  build: {
    ...sharedConfig.build,
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
    emptyOutDir: false,
    target: 'chrome114',
  },
});

// Renderer config
export const rendererConfig = defineConfig({
  ...sharedConfig,
  root: path.join(__dirname, 'src/views'),
  server: {
    port: 5173,
    hmr: {
      overlay: true,
    },
  },
  define: {
    // Manually expose non-VITE_ prefixed env vars to renderer
    'process.env.OPEN_DEV_TOOLS': JSON.stringify(process.env.OPEN_DEV_TOOLS),
  },
  build: {
    ...sharedConfig.build,
    outDir: '../../.vite/renderer/main_window',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/views/index.html'),
      output: {
        format: 'es',
        entryFileNames: isProduction ? 'assets/[name]-[hash].js' : 'assets/[name].js',
        chunkFileNames: isProduction ? 'assets/[name]-[hash].js' : 'assets/[name].js',
        assetFileNames: isProduction ? 'assets/[name]-[hash].[ext]' : 'assets/[name].[ext]',
      },
    },
    target: 'chrome114',
  },
  plugins: [react()],
  css: {
    postcss: {
      plugins: [require('tailwindcss'), require('autoprefixer')],
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand', '@radix-ui/react-*', 'react-window'],
  },
});

// Default export for main config
export default mainConfig;
