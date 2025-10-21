#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Prepares the webpack output for electron-builder
 * by copying from electron-forge's structure to electron-builder's expected structure
 */

const sourceDir = path.join(__dirname, '../.webpack');
const targetDir = path.join(__dirname, '../dist');

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Find the architecture directory (arm64, x64, etc.)
const archDirs = fs.readdirSync(sourceDir).filter(dir => {
  const fullPath = path.join(sourceDir, dir);
  return fs.statSync(fullPath).isDirectory() && dir !== 'renderer';
});

if (archDirs.length === 0) {
  console.error('❌ No webpack output found. Run "npm run compile" first.');
  process.exit(1);
}

// Use the first architecture directory found
const archDir = archDirs[0];
const archSourceDir = path.join(sourceDir, archDir);

console.log(`📦 Preparing build from ${archDir} webpack output...`);

// Copy main process files
const mainSource = path.join(archSourceDir, 'main');
const mainTarget = path.join(targetDir, 'main');
if (fs.existsSync(mainSource)) {
  fs.cpSync(mainSource, mainTarget, { recursive: true });
  console.log('✓ Copied main process files');
}

// Copy renderer process files
const rendererSource = path.join(archSourceDir, 'renderer');
const rendererTarget = path.join(targetDir, 'renderer');
if (fs.existsSync(rendererSource)) {
  fs.cpSync(rendererSource, rendererTarget, { recursive: true });
  console.log('✓ Copied renderer process files');
}

// Create a simple entry point for electron-builder
const entryPoint = `
// Entry point for electron-builder
if (process.env.NODE_ENV === 'production') {
  require('./main/index.js');
} else {
  require('./main/index.js');
}
`;

fs.writeFileSync(path.join(targetDir, 'index.js'), entryPoint.trim());
console.log('✓ Created entry point');

console.log('✅ Build preparation complete!');