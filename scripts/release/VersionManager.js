const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class VersionManager {
  constructor() {
    this.packagePath = path.join(__dirname, '../../package.json');
  }

  async bumpVersion(releaseType = 'auto') {
    const oldVersion = this.getCurrentVersion();

    try {
      const args = releaseType === 'auto'
        ? []
        : ['--release-as', releaseType];

      execSync(`npx standard-version ${args.join(' ')}`, {
        cwd: path.join(__dirname, '../..'),
        stdio: 'inherit'
      });

      const newVersion = this.getCurrentVersion();
      const changelog = this.getLatestChangelog();

      return { oldVersion, newVersion, changelog };
    } catch (error) {
      throw new Error(`Version bump failed: ${error.message}`);
    }
  }

  getCurrentVersion() {
    const packageJson = JSON.parse(fs.readFileSync(this.packagePath, 'utf8'));
    return packageJson.version;
  }

  getLatestChangelog() {
    const changelogPath = path.join(__dirname, '../../CHANGELOG.md');
    try {
      const changelog = fs.readFileSync(changelogPath, 'utf8');
      const sections = changelog.split(/^## /m);
      return sections[1] ? `## ${sections[1].trim()}` : '';
    } catch (error) {
      return '';
    }
  }
}

module.exports = VersionManager;