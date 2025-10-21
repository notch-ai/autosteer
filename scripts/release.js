#!/usr/bin/env node

const VersionManager = require('./release/VersionManager');
const BuildOrchestrator = require('./release/BuildOrchestrator');
const GitHubPublisher = require('./release/GitHubPublisher');

class ReleaseCommand {
  constructor() {
    this.versionManager = new VersionManager();
    this.buildOrchestrator = new BuildOrchestrator();
    this.githubPublisher = new GitHubPublisher();
  }

  async execute(options = {}) {
    console.log('🚀 AutoSteer Desktop Release Process\n');

    try {
      let version, artifacts;

      // Step 1: Version Management
      if (!options.skipVersion) {
        console.log('📝 Bumping version...');
        const versionInfo = await this.versionManager.bumpVersion(options.releaseType || 'auto');
        version = versionInfo.newVersion;
        console.log(`✅ Version: ${versionInfo.oldVersion} → ${version}\n`);
      } else {
        version = this.versionManager.getCurrentVersion();
        console.log(`📌 Current version: ${version}\n`);
      }

      // Step 2: Build
      if (!options.skipBuild) {
        console.log('🔨 Building release artifacts...');
        const buildResult = await this.buildOrchestrator.buildForCurrentPlatform();

        if (!buildResult.success) {
          throw new Error(`Build failed: ${buildResult.error}`);
        }

        artifacts = buildResult.artifacts;
        console.log(`✅ Built ${artifacts.length} artifact(s)\n`);

        // Step 3: Validate
        console.log('🔍 Validating artifacts...');
        const validation = await this.buildOrchestrator.validateArtifacts(artifacts);

        if (!validation.valid) {
          console.warn('⚠️  Validation issues:');
          validation.issues.forEach(issue => console.warn(`   - ${issue}`));
          console.log('');
        }
      } else {
        console.log('⏭️  Skipping build step\n');
      }

      // Step 4: Publish
      if (!options.skipPublish && artifacts) {
        console.log('📦 Publishing to GitHub...');
        const publishResult = await this.githubPublisher.createRelease(
          version,
          artifacts,
          { draft: options.draft || false }
        );

        if (!publishResult.success) {
          throw new Error(`Publish failed: ${publishResult.error}`);
        }

        console.log(`✅ Release published!\n`);
        console.log(`🔗 ${publishResult.releaseUrl}\n`);
      } else if (options.skipPublish) {
        console.log('⏭️  Skipping publish step\n');
      } else if (!artifacts) {
        console.log('⚠️  Cannot publish without build artifacts\n');
      }

      console.log('🎉 Release process complete!');

    } catch (error) {
      console.error(`\n❌ Release failed: ${error.message}`);
      // Only exit if running as main module
      if (require.main === module) {
        process.exit(1);
      }
      throw error; // Re-throw for tests
    }
  }

  parseArguments() {
    const args = process.argv.slice(2);
    const options = {
      skipVersion: args.includes('--skip-version'),
      skipBuild: args.includes('--skip-build'),
      skipPublish: args.includes('--skip-publish'),
      draft: args.includes('--draft'),
      releaseType: 'auto'
    };

    const releaseTypeIndex = args.indexOf('--release-type');
    if (releaseTypeIndex !== -1 && args[releaseTypeIndex + 1]) {
      options.releaseType = args[releaseTypeIndex + 1];
    }

    return options;
  }
}

// Main execution
if (require.main === module) {
  const command = new ReleaseCommand();
  const options = command.parseArguments();
  command.execute(options);
}

module.exports = ReleaseCommand;