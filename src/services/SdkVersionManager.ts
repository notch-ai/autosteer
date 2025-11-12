import { logger } from '@/commons/utils/logger';
import semver from 'semver';

/**
 * SDK version compatibility and migration manager
 *
 * Tracks breaking SDK versions and provides migration functions
 * to handle schema changes across SDK updates
 */

export interface SdkBreakingChange {
  version: string; // Semver version that introduced the breaking change
  description: string; // Human-readable description of the change
  affectedMessageTypes: string[]; // Message types affected by this change
  migrate?: (message: unknown) => unknown; // Optional migration function
}

/**
 * Registry of known breaking SDK versions
 *
 * Add entries here when upgrading SDK versions that change message formats
 */
export const BREAKING_SDK_VERSIONS: SdkBreakingChange[] = [
  {
    version: '0.2.0',
    description: 'Added messageType and messageSubtype to trace logs',
    affectedMessageTypes: ['system', 'assistant', 'tool', 'result', 'error', 'stream_event'],
    migrate: (message: unknown) => {
      // No migration needed - fields are optional
      return message;
    },
  },
  // Add future breaking changes here following this pattern:
  // {
  //   version: '0.3.0',
  //   description: 'Changed X field to Y field',
  //   affectedMessageTypes: ['assistant'],
  //   migrate: (message: unknown) => {
  //     // Migration logic here
  //     const msg = message as Record<string, unknown>;
  //     if (msg.oldField) {
  //       msg.newField = msg.oldField;
  //       delete msg.oldField;
  //     }
  //     return msg;
  //   },
  // },
];

export class SdkVersionManager {
  private static instance: SdkVersionManager;
  private currentVersion: string;

  private constructor() {
    // Get current SDK version from environment or package.json
    this.currentVersion = process.env.CLAUDE_SDK_VERSION || '0.1.0';
  }

  static getInstance(): SdkVersionManager {
    if (!SdkVersionManager.instance) {
      SdkVersionManager.instance = new SdkVersionManager();
    }
    return SdkVersionManager.instance;
  }

  /**
   * Get current SDK version
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Check if a version has known breaking changes
   */
  hasBreakingChanges(version: string): boolean {
    return BREAKING_SDK_VERSIONS.some((change) => {
      try {
        return semver.satisfies(version, `>=${change.version}`);
      } catch (error) {
        logger.warn('[SdkVersionManager] Invalid semver version', { version, error });
        return false;
      }
    });
  }

  /**
   * Get all breaking changes for a version range
   */
  getBreakingChanges(fromVersion: string, toVersion: string): SdkBreakingChange[] {
    const changes: SdkBreakingChange[] = [];

    for (const change of BREAKING_SDK_VERSIONS) {
      try {
        // Check if breaking change is between fromVersion and toVersion
        if (semver.gt(change.version, fromVersion) && semver.lte(change.version, toVersion)) {
          changes.push(change);
        }
      } catch (error) {
        logger.warn('[SdkVersionManager] Invalid semver comparison', {
          fromVersion,
          toVersion,
          changeVersion: change.version,
          error,
        });
      }
    }

    return changes.sort((a, b) => semver.compare(a.version, b.version));
  }

  /**
   * Migrate a message through all applicable breaking changes
   */
  migrateMessage(
    message: unknown,
    fromVersion: string,
    toVersion?: string
  ): { migratedMessage: unknown; appliedMigrations: string[] } {
    const targetVersion = toVersion || this.currentVersion;
    const changes = this.getBreakingChanges(fromVersion, targetVersion);
    const appliedMigrations: string[] = [];

    let migratedMessage = message;

    for (const change of changes) {
      if (change.migrate) {
        try {
          migratedMessage = change.migrate(migratedMessage);
          appliedMigrations.push(`${change.version}: ${change.description}`);

          logger.debug('[SdkVersionManager] Applied migration', {
            version: change.version,
            description: change.description,
          });
        } catch (error) {
          logger.error('[SdkVersionManager] Migration failed', {
            version: change.version,
            description: change.description,
            error: String(error),
          });
          // Continue with next migration despite failure
        }
      }
    }

    return { migratedMessage, appliedMigrations };
  }

  /**
   * Check version compatibility and log warnings
   */
  checkVersionCompatibility(messageVersion?: string): {
    compatible: boolean;
    warnings: string[];
  } {
    if (!messageVersion) {
      return { compatible: true, warnings: [] };
    }

    const warnings: string[] = [];

    try {
      // Check if message version is older than current SDK
      if (semver.lt(messageVersion, this.currentVersion)) {
        const changes = this.getBreakingChanges(messageVersion, this.currentVersion);

        if (changes.length > 0) {
          warnings.push(
            `Message from SDK version ${messageVersion} may need migration (current: ${this.currentVersion})`
          );
          warnings.push(`Breaking changes: ${changes.map((c) => c.version).join(', ')}`);
        }
      }

      // Check if message version is newer than current SDK
      if (semver.gt(messageVersion, this.currentVersion)) {
        warnings.push(
          `Message from newer SDK version ${messageVersion} (current: ${this.currentVersion}). ` +
            'Consider upgrading SDK to ensure full compatibility.'
        );
      }
    } catch (error) {
      logger.warn('[SdkVersionManager] Version compatibility check failed', {
        messageVersion,
        currentVersion: this.currentVersion,
        error,
      });
      return { compatible: true, warnings: ['Unable to verify version compatibility'] };
    }

    return {
      compatible: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Get breaking changes that affect a specific message type
   */
  getBreakingChangesForType(messageType: string, fromVersion: string): SdkBreakingChange[] {
    const changes = this.getBreakingChanges(fromVersion, this.currentVersion);
    return changes.filter((change) => change.affectedMessageTypes.includes(messageType));
  }
}
