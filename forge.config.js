const path = require('path');

module.exports = {
  packagerConfig: {
    asar: {
      unpack: '**/node_modules/@anthropic-ai/**/*',
    },
    prune: false,
    ignore: (file) => {
      if (!file) return false;
      const shouldKeep = file.startsWith('/.vite') || file.startsWith('/node_modules');
      return !shouldKeep;
    },
    name: 'AutoSteer',
    executableName: 'autosteer',
    icon: './assets/icon',
    appBundleId: 'com.autosteer.platform',
    appCategoryType: 'public.app-category.productivity',
    extraResources: [],
    osxSign: process.env.APPLE_CERTIFICATE ? {} : false,
    osxNotarize:
      process.env.APPLE_ID && !process.env.SKIP_NOTARIZE
        ? {
            tool: 'notarytool', 
            appleId: process.env.APPLE_ID,
            appleIdPassword: process.env.APPLE_ID_PASSWORD, 
            teamId: process.env.APPLE_TEAM_ID,
          }
        : undefined,
  },
  rebuildConfig: {
    onlyModules: ['node-pty'],
  },
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
      config: {},
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          name: 'autosteer',
          maintainer: 'AutoSteer Team',
          homepage: 'https://autosteer.ai',
          icon: './assets/icon-dock-app.png',
          categories: ['Development', 'Utility'],
          productName: 'AutoSteer',
          genericName: 'AI Platform',
          description: 'Desktop application for AutoSteer',
          productDescription: 'A comprehensive AI-powered platform with desktop integration',
          license: 'MIT',
          bin: 'autosteer',
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          name: 'autosteer',
          productName: 'AutoSteer',
          genericName: 'AI Platform',
          description: 'Desktop application for AutoSteer',
          productDescription: 'A comprehensive AI-powered platform with desktop integration',
          license: 'MIT',
          homepage: 'https://autosteer.ai',
          icon: './assets/icon-dock-app.png',
          categories: ['Development', 'Utility'],
          bin: 'autosteer',
        },
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/main/main.ts',
            config: 'vite.main.config.ts',
            target: 'main',
          },
          {
            entry: 'src/main/preload.ts',
            config: 'vite.preload.config.ts',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.ts',
          },
        ],
      },
    },
  ],
};
