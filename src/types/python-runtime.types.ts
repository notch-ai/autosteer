/**
 * TypeScript type definitions for Python Runtime Environment integration.
 * Provides type safety for Python process management, testing, and IPC communication.
 *
 * @module python-runtime.types
 */

/**
 * Platform-specific operating system identifiers.
 */
export type Platform = 'darwin' | 'win32' | 'linux';

/**
 * Absolute path to the Python executable.
 */
export type PythonPath = string;

/**
 * Current state of the Python runtime process.
 */
export type ProcessState = 'idle' | 'starting' | 'running' | 'stopping' | 'error';

/**
 * Error codes for Python runtime failures.
 */
export type PythonRuntimeErrorCode =
  | 'PYTHON_NOT_FOUND'
  | 'SDK_IMPORT_FAILED'
  | 'SPAWN_FAILED'
  | 'KILL_FAILED'
  | 'TEST_FAILED'
  | 'ALREADY_RUNNING'
  | 'NOT_RUNNING'
  | 'PARSE_ERROR';

/**
 * Configuration options for Python runtime initialization.
 */
export interface PythonRuntimeConfig {
  /**
   * Optional custom path to Python executable.
   * If not provided, system default will be used.
   */
  pythonPath?: string;

  /**
   * Automatically restart runtime on failure.
   * @default false
   */
  autoRestart?: boolean;

  /**
   * Path to the Python test script.
   * Used for runtime verification.
   */
  testScriptPath?: string;
}

/**
 * Result of testing the Python runtime environment.
 * Contains version information and import status.
 */
export interface PythonTestResult {
  /**
   * Whether the test completed successfully.
   */
  success: boolean;

  /**
   * Python interpreter version string (e.g., "3.12.0").
   */
  pythonVersion: string;

  /**
   * Claude Code SDK version string.
   */
  sdkVersion: string;

  /**
   * Status of SDK import verification.
   */
  importStatus: 'SUCCESS' | 'FAILURE';

  /**
   * Error message if test failed.
   */
  error?: string;

  /**
   * Unix timestamp when test was executed.
   */
  timestamp: number;
}

/**
 * Service interface for managing Python runtime lifecycle.
 * Provides methods for process control and runtime verification.
 */
export interface IPythonRuntimeService {
  /**
   * Spawn the Python runtime process.
   * @throws {PythonRuntimeError} If spawn fails or runtime already running
   */
  spawn(): Promise<void>;

  /**
   * Kill the running Python runtime process.
   * @throws {PythonRuntimeError} If kill fails or runtime not running
   */
  kill(): Promise<void>;

  /**
   * Restart the Python runtime process.
   * Performs graceful shutdown followed by spawn.
   * @throws {PythonRuntimeError} If restart sequence fails
   */
  restart(): Promise<void>;

  /**
   * Test the Python runtime environment.
   * Verifies Python version and SDK import capability.
   * @returns {Promise<PythonTestResult>} Test results with version info
   * @throws {PythonRuntimeError} If test execution fails
   */
  testRuntime(): Promise<PythonTestResult>;

  /**
   * Get the path to the Python executable being used.
   * @returns {string} Absolute path to Python binary
   */
  getPythonPath(): string;

  /**
   * Check if the Python runtime process is currently running.
   * @returns {boolean} True if process is active
   */
  isRunning(): boolean;

  /**
   * Check if the Python runtime environment is available and functional.
   * Verifies both Python installation and SDK availability.
   * @returns {boolean} True if runtime is ready for use
   */
  isRuntimeAvailable(): boolean;
}

/**
 * Custom error class for Python runtime failures.
 * Includes error code for programmatic error handling.
 */
export class PythonRuntimeError extends Error {
  /**
   * Error code categorizing the failure type.
   */
  public readonly code: PythonRuntimeErrorCode;

  /**
   * Create a new Python runtime error.
   * @param message Human-readable error description
   * @param code Error code for categorization
   */
  constructor(message: string, code: PythonRuntimeErrorCode) {
    super(`${code}: ${message}`);
    this.name = 'PythonRuntimeError';
    this.code = code;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, PythonRuntimeError.prototype);
  }
}

/**
 * IPC request payload for testing Python runtime.
 * No parameters required as test uses default configuration.
 */
export interface TestPythonRuntimeRequest {
  // Intentionally empty - test uses service defaults
}

/**
 * IPC response payload for Python runtime test results.
 */
export interface TestPythonRuntimeResponse {
  /**
   * Whether the IPC operation completed successfully.
   */
  success: boolean;

  /**
   * Test results if operation succeeded.
   */
  result?: PythonTestResult;

  /**
   * Error message if operation failed.
   */
  error?: string;
}
