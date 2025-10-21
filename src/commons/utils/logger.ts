/**
 * Logger utility that uses electron-log when available, always with console fallback
 */

// Type guard to check if we're in a browser environment
const isRenderer = () => typeof window !== 'undefined' && window !== null;

// Access electron API safely
const getElectronLog = () => {
  if (isRenderer() && (window as any).electron?.log) {
    return (window as any).electron.log;
  }
  return null;
};

export const logger = {
  info: (message: string, ...args: any[]) => {
    const electronLog = getElectronLog();
    if (electronLog?.info) {
      // Always log to both electron-log and console
      electronLog.info(message, ...args).catch(console.error);
    }
    console.log(message, ...args);
  },

  warn: (message: string, ...args: any[]) => {
    const electronLog = getElectronLog();
    if (electronLog?.warn) {
      electronLog.warn(message, ...args).catch(console.error);
    }
    console.warn(message, ...args);
  },

  error: (message: string, ...args: any[]) => {
    const electronLog = getElectronLog();
    if (electronLog?.error) {
      electronLog.error(message, ...args).catch(console.error);
    }
    console.error(message, ...args);
  },

  debug: (message: string, ...args: any[]) => {
    const electronLog = getElectronLog();
    if (electronLog?.debug) {
      electronLog.debug(message, ...args).catch(console.error);
    }
    console.debug(message, ...args);
  },

  // Convenience method to log with a specific level
  log: (level: 'info' | 'warn' | 'error' | 'debug', message: string, ...args: any[]) => {
    logger[level](message, ...args);
  },
};
