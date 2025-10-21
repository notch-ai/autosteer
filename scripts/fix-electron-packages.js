#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Copies electron packages from parent node_modules to local node_modules
 * This is needed for electron-forge to work properly in pnpm workspaces
 */

const packagesToCopy = ['electron', '@electron', '@electron-forge'];
const parentNodeModules = path.join(__dirname, '../../node_modules');
const localNodeModules = path.join(__dirname, '../node_modules');

// Ensure local node_modules exists
if (!fs.existsSync(localNodeModules)) {
  fs.mkdirSync(localNodeModules, { recursive: true });
}

packagesToCopy.forEach((pkg) => {
  const sourcePath = path.join(parentNodeModules, pkg);
  const destPath = path.join(localNodeModules, pkg);

  if (fs.existsSync(sourcePath)) {
    // Remove existing destination if it exists
    if (fs.existsSync(destPath)) {
      fs.rmSync(destPath, { recursive: true, force: true });
    }

    // Copy the package
    fs.cpSync(sourcePath, destPath, { recursive: true });
    console.log(`✓ Copied ${pkg} to local node_modules`);
  } else {
    console.log(`⚠ Package ${pkg} not found in parent node_modules`);
  }
});

console.log('✅ Electron packages fixed for pnpm workspace');

// Download electron binary if it doesn't exist
const electronPath = path.join(localNodeModules, 'electron');
const electronDistPath = path.join(electronPath, 'dist');

if (fs.existsSync(electronPath) && !fs.existsSync(electronDistPath)) {
  console.log('📥 Downloading Electron binary...');
  try {
    // Run electron's install script to download the binary
    execSync('node install.js', {
      cwd: electronPath,
      stdio: 'inherit',
    });
    console.log('✅ Electron binary downloaded successfully');
  } catch (error) {
    console.error('❌ Failed to download Electron binary:', error.message);
    console.log('You may need to run: node autosteer/node_modules/electron/install.js');
  }
}
