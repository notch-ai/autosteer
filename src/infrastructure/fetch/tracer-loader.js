/**
 * Tracer loader - Entry point for fetch instrumentation via --require flag
 *
 * ⚠️ SUBPROCESS INFRASTRUCTURE ⚠️
 * This runs in SDK CHILD PROCESSES. Must use process.env (not settings.ts).
 * Environment variables are set by parent process (ClaudeCodeSDKService).
 *
 * It must be a CommonJS module since --require doesn't support ES modules.
 *
 * Usage: node --require fetch-tracer-loader.js /path/to/cli.js
 */

// Helper to log to stderr (stdout is reserved for SDK JSON messages)
// Only log if FETCH_TRACE_DEBUG is set to avoid corrupting SDK JSON output
// NOTE: Must use process.env - this runs in SDK subprocess, not main process
const DEBUG = process.env.FETCH_TRACE_DEBUG === 'true';

const logToStderr = (message, data) => {
  if (!DEBUG) return; // Silent by default

  if (data) {
    process.stderr.write(`${message} ${JSON.stringify(data, null, 2)}\n`);
  } else {
    process.stderr.write(`${message}\n`);
  }
};

// Write to file to confirm loader is executed and log all steps
const fs = require('fs');
const os = require('os');
const path = require('path');
const logFile = path.join(os.homedir(), '.autosteer', 'sessions', 'tracer-loader-debug.log');

const logToFile = (message) => {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] [pid=${process.pid}] ${message}\n`);
  } catch (e) {}
};

logToFile(`Tracer loader started, FETCH_TRACE_ENABLED=${process.env.FETCH_TRACE_ENABLED}`);

logToStderr('[fetch-tracer-loader] Starting fetch tracer injection');
logToStderr('[fetch-tracer-loader] Process:', {
  pid: process.pid,
  execPath: process.execPath,
  version: process.version,
  cwd: process.cwd(),
  env: {
    FETCH_TRACE_ENABLED: process.env.FETCH_TRACE_ENABLED,
    FETCH_TRACE_INCLUDES: process.env.FETCH_TRACE_INCLUDES,
    FETCH_TRACE_EXCLUDES: process.env.FETCH_TRACE_EXCLUDES,
    NODE_OPTIONS: process.env.NODE_OPTIONS,
  },
});

try {
  // Use require.resolve to find the compiled fetch-tracer module
  // Note: fetch-tracer.cjs extension forces CommonJS treatment
  logToFile('Resolving fetch-tracer module...');
  logToStderr('[fetch-tracer-loader] Resolving fetch-tracer module...');
  const fetchTracerPath = require.resolve('./fetch-tracer.cjs');
  logToFile(`Resolved fetch-tracer at: ${fetchTracerPath}`);
  logToStderr('[fetch-tracer-loader] Resolved fetch-tracer at:', fetchTracerPath);

  // Load the fetch tracer module
  logToFile('Loading fetch-tracer module...');
  logToStderr('[fetch-tracer-loader] Loading fetch-tracer module...');
  const { instrumentFetchTracer } = require(fetchTracerPath);
  logToFile(`Module loaded, instrumentFetchTracer type: ${typeof instrumentFetchTracer}`);
  logToStderr(
    '[fetch-tracer-loader] Module loaded, instrumentFetchTracer:',
    typeof instrumentFetchTracer
  );

  // Initialize the fetch tracer immediately
  logToFile('Calling instrumentFetchTracer()...');
  logToStderr('[fetch-tracer-loader] Calling instrumentFetchTracer()...');
  instrumentFetchTracer();
  logToFile('✅ Fetch tracer successfully injected');

  logToStderr('[fetch-tracer-loader] ✅ Fetch tracer successfully injected into subprocess');
} catch (error) {
  logToFile(`❌ Failed to inject fetch tracer: ${error.message}`);
  logToFile(`Stack: ${error.stack}`);
  logToStderr('[fetch-tracer-loader] ❌ Failed to inject fetch tracer:', {
    error: error.message,
    stack: error.stack,
    code: error.code,
  });
  // Don't exit - allow the CLI to continue even if tracing fails
}
