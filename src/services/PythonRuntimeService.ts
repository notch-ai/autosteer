/**
 * PythonRuntimeService
 *
 * Manages the Python runtime environment lifecycle for claude-agent-sdk integration.
 * Handles platform-specific path resolution, process spawning/killing, and runtime testing.
 *
 * Key features:
 * - Singleton pattern for centralized process management
 * - Platform-specific Python path resolution (macOS/Windows/Linux)
 * - Process lifecycle management (spawn, kill, restart)
 * - Runtime testing with JSON-based result parsing
 * - Comprehensive error handling with typed error codes
 * - Development vs production mode path resolution
 *
 * @example
 * ```typescript
 * const service = PythonRuntimeService.getInstance();
 * await service.spawn();
 * const result = await service.testRuntime();
 * console.log('Python:', result.pythonVersion, 'SDK:', result.sdkVersion);
 * await service.kill();
 * ```
 */

import { ChildProcess, spawn } from 'child_process';
import { app } from 'electron';
import log from 'electron-log/main';
import * as fs from 'fs';
import * as path from 'path';
import {
  IPythonRuntimeService,
  PythonTestResult,
  PythonRuntimeError,
  PythonRuntimeConfig,
  ProcessState,
  Platform,
} from '@/types/python-runtime.types';

export class PythonRuntimeService implements IPythonRuntimeService {
  private static instance: PythonRuntimeService;
  private process: ChildProcess | null = null;
  private state: ProcessState = 'idle';
  private config: PythonRuntimeConfig | undefined;

  private constructor(config?: PythonRuntimeConfig) {
    this.config = config ?? undefined;
  }

  static getInstance(config?: PythonRuntimeConfig): PythonRuntimeService {
    if (!PythonRuntimeService.instance) {
      PythonRuntimeService.instance = new PythonRuntimeService(config);
    }
    return PythonRuntimeService.instance;
  }

  getPythonPath(): string {
    if (this.config?.pythonPath) {
      return this.config.pythonPath;
    }

    const platform = process.platform as Platform;
    const isPackaged = app.isPackaged;

    let basePath: string;
    let pythonPath: string;
    const candidatePaths: string[] = [];

    if (isPackaged) {
      // Production: Python runtime bundled in app Resources
      basePath = process.resourcesPath || '';

      switch (platform) {
        case 'darwin':
        case 'linux':
          candidatePaths.push(path.join(basePath, 'ai-service-v2', '.venv', 'bin', 'python'));
          break;
        case 'win32':
          candidatePaths.push(
            path.join(basePath, 'ai-service-v2', '.venv', 'Scripts', 'python.exe')
          );
          break;
        default:
          candidatePaths.push(path.join(basePath, 'ai-service-v2', '.venv', 'bin', 'python'));
      }
    } else {
      // Development: Try project's ai-service-v2/.venv first
      basePath = path.join(__dirname, '..', '..', '..', 'ai-service-v2');

      switch (platform) {
        case 'darwin':
        case 'linux':
          candidatePaths.push(path.join(basePath, '.venv', 'bin', 'python'));
          break;
        case 'win32':
          candidatePaths.push(path.join(basePath, '.venv', 'Scripts', 'python.exe'));
          break;
        default:
          candidatePaths.push(path.join(basePath, '.venv', 'bin', 'python'));
      }
    }

    // Add system Python as fallback
    switch (platform) {
      case 'darwin':
      case 'linux':
        candidatePaths.push('python3', 'python');
        break;
      case 'win32':
        candidatePaths.push('python.exe', 'python');
        break;
    }

    // Try each candidate path
    for (const candidate of candidatePaths) {
      if (fs.existsSync(candidate)) {
        pythonPath = candidate;
        log.debug('[PythonRuntimeService] Found Python at candidate path', {
          platform,
          isPackaged,
          pythonPath: candidate,
          type: candidate.includes('.venv') ? 'bundled' : 'system',
        });
        return pythonPath;
      }
    }

    // No Python found, return first candidate (will fail with clear error)
    pythonPath = candidatePaths[0];
    log.warn('[PythonRuntimeService] No Python found, using first candidate', {
      platform,
      isPackaged,
      basePath,
      pythonPath,
      candidatesChecked: candidatePaths.length,
    });

    return pythonPath;
  }

  isRunning(): boolean {
    return this.state === 'running';
  }

  isRuntimeAvailable(): boolean {
    const pythonPath = this.getPythonPath();
    return fs.existsSync(pythonPath);
  }

  async spawn(): Promise<void> {
    if (this.isRunning()) {
      const error = new PythonRuntimeError('Python runtime is already running', 'ALREADY_RUNNING');
      log.error('[PythonRuntimeService] Spawn failed - already running', {
        state: this.state,
      });
      throw error;
    }

    const pythonPath = this.getPythonPath();

    if (!fs.existsSync(pythonPath)) {
      const error = new PythonRuntimeError(
        `Python runtime not found at ${pythonPath}`,
        'PYTHON_NOT_FOUND'
      );
      log.error('[PythonRuntimeService] Python runtime not found', {
        pythonPath,
      });
      throw error;
    }

    try {
      this.state = 'starting';

      this.process = spawn(pythonPath, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.process.on('exit', (code) => {
        log.info('[PythonRuntimeService] Python process exited', { code });
        this.state = 'idle';
        this.process = null;
      });

      this.process.on('error', (error) => {
        log.error('[PythonRuntimeService] Python process error', {
          error: error.message,
        });
        this.state = 'error';
      });

      this.state = 'running';

      log.info('[PythonRuntimeService] Python process spawned', {
        pid: this.process.pid,
        pythonPath,
      });
    } catch (error) {
      this.state = 'error';
      const spawnError = new PythonRuntimeError(
        `Failed to spawn Python process: ${error instanceof Error ? error.message : String(error)}`,
        'SPAWN_FAILED'
      );
      log.error('[PythonRuntimeService] Spawn failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw spawnError;
    }
  }

  async kill(): Promise<void> {
    if (!this.isRunning() || !this.process) {
      const error = new PythonRuntimeError('Python runtime is not running', 'NOT_RUNNING');
      log.error('[PythonRuntimeService] Kill failed - not running', {
        state: this.state,
      });
      throw error;
    }

    try {
      this.state = 'stopping';
      const killed = this.process.kill('SIGTERM');

      if (!killed) {
        this.state = 'running';
        const error = new PythonRuntimeError('Failed to kill Python process', 'KILL_FAILED');
        log.error('[PythonRuntimeService] Kill failed', {
          pid: this.process.pid,
        });
        throw error;
      }

      this.state = 'idle';
      this.process = null;

      log.info('[PythonRuntimeService] Python process killed', {
        signal: 'SIGTERM',
      });
    } catch (error) {
      if (error instanceof PythonRuntimeError) {
        throw error;
      }
      this.state = 'running';
      const killError = new PythonRuntimeError(
        `Failed to kill Python process: ${error instanceof Error ? error.message : String(error)}`,
        'KILL_FAILED'
      );
      log.error('[PythonRuntimeService] Kill failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw killError;
    }
  }

  async restart(): Promise<void> {
    if (this.isRunning()) {
      await this.kill();
    }

    await this.spawn();

    log.info('[PythonRuntimeService] Python process restarted', {
      pid: this.process?.pid,
    });
  }

  async testRuntime(): Promise<PythonTestResult> {
    const pythonPath = this.getPythonPath();

    if (!fs.existsSync(pythonPath)) {
      const error = new PythonRuntimeError(
        `Python runtime not found at ${pythonPath}`,
        'PYTHON_NOT_FOUND'
      );
      log.error('[PythonRuntimeService] Test failed - runtime not found', {
        pythonPath,
      });
      throw error;
    }

    const scriptPath = this.config?.testScriptPath || this.getDefaultTestScriptPath();

    return new Promise<PythonTestResult>((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const testProcess = spawn(pythonPath, [scriptPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timeout = setTimeout(() => {
        testProcess.kill();
        const error = new PythonRuntimeError(
          'Runtime test timed out after 5 seconds',
          'TEST_FAILED'
        );
        log.error('[PythonRuntimeService] Runtime test timed out');
        reject(error);
      }, 5000);

      testProcess.stdout?.setEncoding('utf8');
      testProcess.stderr?.setEncoding('utf8');

      testProcess.stdout?.on('data', (data) => {
        stdout += data;
      });

      testProcess.stderr?.on('data', (data) => {
        stderr += data;
      });

      testProcess.on('exit', (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          const error = new PythonRuntimeError(
            `Runtime test failed with exit code ${code}`,
            'TEST_FAILED'
          );
          log.error('[PythonRuntimeService] Runtime test failed', {
            code,
            stderr,
          });
          reject(error);
          return;
        }

        try {
          const result = JSON.parse(stdout.trim()) as PythonTestResult;

          log.info('[PythonRuntimeService] Runtime test completed', {
            success: result.success,
            pythonVersion: result.pythonVersion,
            sdkVersion: result.sdkVersion,
            importStatus: result.importStatus,
          });

          resolve(result);
        } catch (error) {
          const parseError = new PythonRuntimeError(
            `Failed to parse test result: ${error instanceof Error ? error.message : String(error)}`,
            'PARSE_ERROR'
          );
          log.error('[PythonRuntimeService] Failed to parse test result', {
            stdout: stdout.substring(0, 200),
            error: error instanceof Error ? error.message : String(error),
          });
          reject(parseError);
        }
      });

      testProcess.on('error', (error) => {
        clearTimeout(timeout);
        const spawnError = new PythonRuntimeError(
          `Failed to spawn test process: ${error.message}`,
          'SPAWN_FAILED'
        );
        log.error('[PythonRuntimeService] Test process spawn failed', {
          error: error.message,
        });
        reject(spawnError);
      });
    });
  }

  private getDefaultTestScriptPath(): string {
    const isPackaged = app.isPackaged;

    if (isPackaged) {
      // Production: Script bundled in app Resources
      return path.join(process.resourcesPath || '', 'python-bridge', 'test_runtime.py');
    } else {
      // Development: Use project's resources directory
      return path.join(__dirname, '..', '..', 'resources', 'python-bridge', 'test_runtime.py');
    }
  }
}
