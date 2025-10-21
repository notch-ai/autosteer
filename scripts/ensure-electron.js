#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Ensures electron is properly installed for development
 * This handles the common issues when setting up a new worktree
 */

const localNodeModules = path.join(__dirname, '../node_modules');
const electronPath = path.join(localNodeModules, 'electron');
const electronDistPath = path.join(electronPath, 'dist');

console.log('🔍 Checking Electron installation...');

// Check if electron binary exists
if (fs.existsSync(electronPath)) {
  if (fs.existsSync(electronDistPath)) {
    console.log('✅ Electron is already properly installed');
    process.exit(0);
  } else {
    console.log('⚠️  Electron package exists but binary is missing');
  }
} else {
  console.log('❌ Electron package not found in local node_modules');
  console.log('Please run the fix-electron-packages.js script first');
  process.exit(1);
}

// Download electron binary
console.log('📥 Downloading Electron binary...');
try {
  execSync('node install.js', { 
    cwd: electronPath,
    stdio: 'inherit'
  });
  console.log('✅ Electron binary downloaded successfully');
} catch (error) {
  console.error('❌ Failed to download Electron binary:', error.message);
  
  // Try alternative approach
  console.log('🔄 Trying alternative download method...');
  try {
    // Set ELECTRON_SKIP_BINARY_DOWNLOAD to false explicitly
    execSync('ELECTRON_SKIP_BINARY_DOWNLOAD=0 node install.js', { 
      cwd: electronPath,
      stdio: 'inherit',
      shell: true
    });
    console.log('✅ Electron binary downloaded successfully (alternative method)');
  } catch (altError) {
    console.error('❌ Alternative download also failed:', altError.message);
    console.error('\nPlease try running manually:');
    console.error('  cd autosteer/node_modules/electron && node install.js');
    process.exit(1);
  }
}