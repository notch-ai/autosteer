import { defineConfig, createLogger } from 'vite';
import react from '@vitejs/plugin-react';
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
  root: path.join(__dirname, 'src/views'),
  mode: process.env.NODE_ENV || 'development',

  server: {
    port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : 5173,
    strictPort: false, // Allow Vite to auto-increment port if occupied
    hmr:
      process.env.DISABLE_HMR === 'true'
        ? false
        : {
            overlay: true,
          },
  },

  plugins: [
    react(),
    {
      name: 'log-server-url',
      configureServer(server) {
        server.httpServer?.once('listening', () => {
          const address = server.httpServer?.address();
          if (address && typeof address === 'object') {
            const actualPort = address.port;
            const serverUrl = `http://localhost:${actualPort}`;
            console.log(`\n🚀 [Vite Renderer] Dev server running at: ${serverUrl}`);
            console.log(`📁 [Vite Renderer] User Data Dir: ${process.env.ELECTRON_USER_DATA_DIR || 'default'}\n`);

            // Set environment variable for Electron main process to use
            process.env.VITE_DEV_SERVER_URL = serverUrl;
          }
        });
      },
    },
  ],

  build: {
    outDir: '../../.vite/renderer/main_window',
    emptyOutDir: true,
    sourcemap: true,
    minify: process.env.NODE_ENV === 'production',
    reportCompressedSize: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/views/index.html'),
      output: {
        format: 'es',
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    target: 'chrome114', // Electron 28 Chromium version
  },

  css: {
    postcss: {
      plugins: [require('tailwindcss'), require('autoprefixer')],
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@services': path.resolve(__dirname, './src/services'),
      '@views': path.resolve(__dirname, './src/views'),
    },
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand', '@radix-ui/react-*'],
  },
});
