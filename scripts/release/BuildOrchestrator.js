const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class BuildOrchestrator {
  constructor() {
    this.platform = os.platform();
    this.arch = os.arch();
    this.outDir = path.join(__dirname, '../../out');
    this.makeDir = this.outDir; // electron-builder outputs directly to out/
  }

  async buildForCurrentPlatform() {
    console.log(`🔨 Building for ${this.platform} (${this.arch})...`);

    try {
      await this.cleanBuildDirectory();
      await this.runElectronForge();
      const artifacts = await this.collectArtifacts();
      const standardizedArtifacts = await this.standardizeArtifactNames(artifacts);

      return {
        success: true,
        artifacts: standardizedArtifacts
      };
    } catch (error) {
      return {
        success: false,
        artifacts: [],
        error: error.message
      };
    }
  }

  async cleanBuildDirectory() {
    try {
      await fs.rm(this.outDir, { recursive: true, force: true });
      console.log('✓ Cleaned build directory');
    } catch (error) {
      // Directory might not exist, which is fine
    }
  }

  async runElectronForge() {
    return new Promise((resolve, reject) => {
      const makeProcess = spawn('npm', ['run', 'dist'], {
        cwd: path.join(__dirname, '../..'),
        shell: true,
        stdio: 'inherit'
      });

      makeProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Electron Builder failed with code ${code}`));
        }
      });

      makeProcess.on('error', reject);
    });
  }

  async collectArtifacts() {
    const platformPatterns = {
      darwin: ['*.dmg', '*.zip'],
      linux: ['*.deb', '*.rpm']
    };

    const patterns = platformPatterns[this.platform] || [];
    const artifacts = [];

    for (const pattern of patterns) {
      const files = await this.findFiles(this.makeDir, pattern);
      artifacts.push(...files);
    }

    return artifacts;
  }

  async findFiles(directory, pattern) {
    const results = [];

    async function walk(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (matchesPattern(entry.name, pattern)) {
            results.push(fullPath);
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
    }

    function matchesPattern(filename, pattern) {
      // Simple glob matching for *, rest is literal
      const regex = pattern
        .replace(/\./g, '\\.')  // Escape dots first
        .replace(/\*/g, '.*')   // Then replace wildcards
        .replace(/\?/g, '.');
      return new RegExp(`^${regex}$`).test(filename);
    }

    await walk(directory);
    return results;
  }

  async standardizeArtifactNames(artifacts) {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(__dirname, '../../package.json'), 'utf8')
    );
    const version = packageJson.version;

    const standardized = [];

    for (const artifact of artifacts) {
      const ext = path.extname(artifact);
      const platformInfo = this.getPlatformInfo(artifact, ext);

      const newName = `AutoSteer-v${version}-${platformInfo.platform}-${platformInfo.arch}${ext}`;
      const newPath = path.join(path.dirname(artifact), newName);

      await fs.rename(artifact, newPath);

      standardized.push({
        path: newPath,
        name: newName,
        platform: platformInfo.platform,
        arch: platformInfo.arch,
        size: (await fs.stat(newPath)).size
      });

      console.log(`✓ Created ${newName}`);
    }

    return standardized;
  }

  getPlatformInfo(filePath, ext) {
    const mappings = {
      darwin: { platform: 'mac', arch: 'universal' },
      linux: { platform: 'linux', arch: 'x64' }
    };

    return mappings[this.platform] || { platform: 'unknown', arch: 'unknown' };
  }

  async validateArtifacts(artifacts) {
    const issues = [];
    const minSize = 1024 * 1024; // 1MB

    for (const artifact of artifacts) {
      if (artifact.size < minSize) {
        issues.push(`${artifact.name} is too small (${artifact.size} bytes)`);
      }
    }

    // Platform-specific expected artifacts
    const expectedCounts = {
      darwin: 1, // .zip only (DMG maker temporarily disabled)
      linux: 2   // .deb and .rpm
    };

    const expectedCount = expectedCounts[this.platform] || 1;
    if (artifacts.length !== expectedCount) {
      issues.push(`Expected ${expectedCount} artifacts, found ${artifacts.length}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

module.exports = BuildOrchestrator;
