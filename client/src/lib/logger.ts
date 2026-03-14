/**
 * Structured browser console logging with levels.
 *
 * Usage:
 *   const log = createLogger('Settings');
 *   log.info('Saved settings');
 *   log.error('Failed to save', error);
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Default: show warnings and errors in production, everything in dev
const DEFAULT_LEVEL: LogLevel = import.meta.env.DEV ? 'debug' : 'warn';

let globalLevel: LogLevel = DEFAULT_LEVEL;

export function setLogLevel(level: LogLevel) {
  globalLevel = level;
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export function createLogger(name: string): Logger {
  const prefix = `[${name}]`;

  const shouldLog = (level: LogLevel): boolean =>
    LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[globalLevel];

  return {
    debug: (...args: unknown[]) => {
      if (shouldLog('debug')) console.debug(prefix, ...args);
    },
    info: (...args: unknown[]) => {
      if (shouldLog('info')) console.info(prefix, ...args);
    },
    warn: (...args: unknown[]) => {
      if (shouldLog('warn')) console.warn(prefix, ...args);
    },
    error: (...args: unknown[]) => {
      if (shouldLog('error')) console.error(prefix, ...args);
    },
  };
}
