type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LEVEL: LogLevel = __DEV__ ? 'debug' : 'warn';

const shouldLog = (level: LogLevel): boolean =>
  LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL];

const formatMessage = (level: LogLevel, tag: string, message: string): string =>
  `[${level.toUpperCase()}][${tag}] ${message}`;

export const logger = {
  debug: (tag: string, message: string, ...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', tag, message), ...args);
    }
  },
  info: (tag: string, message: string, ...args: unknown[]) => {
    if (shouldLog('info')) {
      console.info(formatMessage('info', tag, message), ...args);
    }
  },
  warn: (tag: string, message: string, ...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', tag, message), ...args);
    }
  },
  error: (tag: string, message: string, ...args: unknown[]) => {
    if (shouldLog('error')) {
      console.error(formatMessage('error', tag, message), ...args);
    }
  },
};
