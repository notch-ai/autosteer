import { defineConfig, createLogger, loadEnv } from 'vite';
import path from 'path';
import { builtinModules } from 'module';
import fs from 'fs';

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

export default defineConfig(({ mode }) => {
  // Load .env file and inject into process.env
  const env = loadEnv(mode, __dirname, '');
  Object.assign(process.env, env);

  return {
    customLogger,
    root: __dirname,
    mode: mode || 'development',

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

    plugins: [
      {
        name: 'copy-fetch-interceptor',
        async closeBundle() {
          // Copy fetch interceptor files to build output directory
          // Use esbuild to convert TSC's ES module output to CommonJS
          const outDir = '.vite/build';
          const loaderSrc = path.resolve(__dirname, 'src/infrastructure/fetch/tracer-loader.js');
          const interceptorSrc = path.resolve(
            __dirname,
            'dist/src/infrastructure/fetch/interceptor.js'
          );
          const tracerSrc = path.resolve(__dirname, 'dist/src/infrastructure/fetch/tracer.js');

          const loaderDest = path.resolve(__dirname, outDir, 'fetch-tracer-loader.cjs');
          const interceptorDest = path.resolve(__dirname, outDir, 'fetch-interceptor.cjs');
          const tracerDest = path.resolve(__dirname, outDir, 'fetch-tracer.cjs');

          try {
            // Copy loader and rename to .cjs
            if (fs.existsSync(loaderSrc)) {
              fs.copyFileSync(loaderSrc, loaderDest);
              customLogger.info(`Copied fetch-tracer-loader.cjs to ${outDir}`);
            }

            const esbuild = await import('esbuild');

            // Convert unified fetch-interceptor from ES module to CommonJS (bundles fetch-cache)
            if (fs.existsSync(interceptorSrc)) {
              await esbuild.build({
                entryPoints: [interceptorSrc],
                outfile: interceptorDest,
                format: 'cjs',
                platform: 'node',
                target: 'node20',
                bundle: true, // Bundle fetch-cache and dependencies
                external: ['lru-cache'], // External dependencies
                minify: false,
                sourcemap: false,
              });
              customLogger.info(`Converted and bundled fetch-interceptor.cjs to ${outDir}`);
            }

            // Convert legacy fetch-tracer from ES module to CommonJS (for backward compatibility)
            if (fs.existsSync(tracerSrc)) {
              await esbuild.build({
                entryPoints: [tracerSrc],
                outfile: tracerDest,
                format: 'cjs',
                platform: 'node',
                target: 'node20',
                bundle: true, // Bundle FetchCacheService and dependencies
                external: ['fs', 'os', 'path', 'better-sqlite3'], // External Node builtins and native modules
                minify: false,
                sourcemap: false,
              });
              customLogger.info(`Converted and bundled fetch-tracer.cjs to ${outDir}`);
            }
          } catch (error) {
            customLogger.warn(`Failed to copy fetch interceptor files: ${error}`);
          }
        },
      },
    ],
  };
});
