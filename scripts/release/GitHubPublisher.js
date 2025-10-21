const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class GitHubPublisher {
  constructor() {
    this.releaseNotesPath = path.join(__dirname, '../../.release-notes.md');
  }

  async createRelease(version, artifacts, options = {}) {
    const tag = `desktop-v${version}`;
    const title = `AutoSteer Desktop v${version}`;

    try {
      // Generate release notes
      await this.generateReleaseNotes(version);

      // Build gh command
      const command = this.buildGhCommand(tag, title, artifacts, options.draft);

      // Execute command
      const releaseUrl = await this.executeGhCommand(command);

      // Cleanup
      await this.cleanup();

      return {
        success: true,
        releaseUrl
      };
    } catch (error) {
      await this.cleanup();
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateReleaseNotes(version) {
    const changelog = await this.getVersionChangelog(version);

    const notes = `# AutoSteer Desktop v${version}

⚠️ **Security Notice**: These builds are not code-signed. You may encounter security warnings during installation:
- **macOS**: "App can't be opened" - Right-click the app and select "Open"
- **Linux**: No warnings expected
- **Windows**: Use WSL to run the Linux build

## What's Changed
${changelog}

## Installation

### macOS
Download \`AutoSteer-v${version}-mac-universal.dmg\`, open it, and drag AutoSteer to Applications.

### Linux
**Debian/Ubuntu:**
\`\`\`bash
sudo dpkg -i AutoSteer-v${version}-linux-x64.deb
\`\`\`

**Fedora/RHEL:**
\`\`\`bash
sudo rpm -i AutoSteer-v${version}-linux-x64.rpm
\`\`\`

### Windows (via WSL)
Install WSL, then use the Linux installation instructions above.
See the [README](https://github.com/notch-ai/autosteer#windows-installation-via-wsl) for detailed WSL setup.

## System Requirements
- macOS 10.15 or later
- Ubuntu 20.04+ / Fedora 35+ (64-bit)
- Windows 10/11 with WSL 2

## Checksums
See the release assets for SHA-256 checksums of all files.`;

    await fs.writeFile(this.releaseNotesPath, notes);
  }

  async getVersionChangelog(version) {
    try {
      const changelogPath = path.join(__dirname, '../../CHANGELOG.md');
      const changelog = await fs.readFile(changelogPath, 'utf8');

      // Split changelog into sections
      const sections = changelog.split(/\n(?=##\s)/);

      // Find the section for this version
      const versionSection = sections.find(section => {
        const firstLine = section.split('\n')[0];
        return firstLine.includes(`[${version}]`) || firstLine.includes(` ${version} `);
      });

      if (!versionSection) {
        return 'See CHANGELOG.md for details.';
      }

      // Extract content after the version header
      const lines = versionSection.split('\n');
      const contentLines = lines.slice(1).filter(line => line.trim());
      return contentLines.join('\n').trim() || 'See CHANGELOG.md for details.';
    } catch (error) {
      return 'See CHANGELOG.md for details.';
    }
  }

  buildGhCommand(tag, title, artifacts, isDraft) {
    const args = [
      'release', 'create', tag,
      '--title', title,
      '--notes-file', this.releaseNotesPath,
      '--target', 'main'
    ];

    if (isDraft) {
      args.push('--draft');
    }

    // Add artifact files
    artifacts.forEach(artifact => {
      args.push(artifact.path);
    });

    return args;
  }

  async executeGhCommand(args) {
    return new Promise((resolve, reject) => {
      exec(`gh ${args.join(' ')}`, (error, stdout, stderr) => {
        if (error) {
          // Check for common errors
          if (stderr.includes('authentication')) {
            reject(new Error('GitHub authentication required. Run: gh auth login'));
          } else if (stderr.includes('already exists')) {
            reject(new Error('Release already exists. Delete it first or use a different version.'));
          } else {
            reject(new Error(stderr || error.message));
          }
          return;
        }

        const releaseUrl = stdout.trim();
        resolve(releaseUrl);
      });
    });
  }

  async generateChecksums(artifacts) {
    const checksums = [];

    for (const artifact of artifacts) {
      const hash = crypto.createHash('sha256');
      const stream = require('fs').createReadStream(artifact.path);

      await new Promise((resolve, reject) => {
        stream.on('data', data => hash.update(data));
        stream.on('end', () => {
          checksums.push({
            file: artifact.name,
            sha256: hash.digest('hex')
          });
          resolve();
        });
        stream.on('error', reject);
      });
    }

    return checksums;
  }

  async cleanup() {
    try {
      await fs.unlink(this.releaseNotesPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

module.exports = GitHubPublisher;
