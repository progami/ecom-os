// Server-only logger that uses winston and fs modules
// This file should only be imported in server-side code

import 'server-only';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logDir = process.env.LOG_DIR || './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
  perf: 7,
};

// Colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'white',
  silly: 'gray',
  perf: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, category, ...metadata }) => {
    let msg = `${timestamp} [${level}]`;
    if (category) msg += ` [${category}]`;
    msg += `: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Create transports
const transports: winston.transport[] = [];

// Console transport
if (process.env.ENABLE_CONSOLE_LOGS !== 'false') {
  transports.push(
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
      level: process.env.LOG_LEVEL || 'info',
    })
  );
}

// File transports with rotation
if (process.env.ENABLE_FILE_LOGS !== 'false') {
  // Combined log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'app-%DATE%.log'),
      datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      format: logFormat,
      level: process.env.LOG_LEVEL || 'info',
    })
  );

  // Error log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      format: logFormat,
      level: 'error',
    })
  );

  // API log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'api-%DATE%.log'),
      datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      format: logFormat,
      level: 'http',
    })
  );

  // Auth log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'auth-%DATE%.log'),
      datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      format: logFormat,
      level: 'info',
    })
  );

  // Performance log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logDir, 'perf-%DATE%.log'),
      datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
      maxSize: process.env.LOG_MAX_SIZE || '20m',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      format: logFormat,
      level: 'perf',
    })
  );
}

// Create main logger instance
const logger = winston.createLogger({
  levels,
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exitOnError: false,
});

// Stream for logs/dev.log (all logs)
if (process.env.NODE_ENV !== 'production') {
  const devLogStream = fs.createWriteStream(path.join(process.cwd(), 'logs', 'dev.log'), {
    flags: 'a', // append mode
  });

  logger.add(
    new winston.transports.Stream({
      stream: devLogStream,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.printf(({ timestamp, level, message, category, ...metadata }) => {
          let msg = `${timestamp} [${level.toUpperCase()}]`;
          if (category) msg += ` [${category}]`;
          msg += `: ${message}`;
          if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
          }
          return msg + '\n';
        })
      ),
    })
  );
}

// Redact sensitive information
function redactSensitiveData(data: unknown): unknown {
  if (!data) return data;

  const sensitiveFields = [
    'password',
    'token',
    'apiKey',
    'secret',
    'authorization',
    'cookie',
    'creditCard',
    'ssn',
    'bankAccount',
  ];

  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }

  if (typeof data === 'object') {
    const redacted = { ...data };
    Object.keys(redacted).forEach((key) => {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some((field) => lowerKey.includes(field))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof redacted[key] === 'object') {
        redacted[key] = redactSensitiveData(redacted[key]);
      }
    });
    return redacted;
  }

  return data;
}

// Helper functions for different log categories
export const systemLogger = {
  info: (message: string, metadata?: unknown) =>
    logger.info(message, { category: 'system', ...redactSensitiveData(metadata) }),
  error: (message: string, metadata?: unknown) =>
    logger.error(message, { category: 'system', ...redactSensitiveData(metadata) }),
  warn: (message: string, metadata?: unknown) =>
    logger.warn(message, { category: 'system', ...redactSensitiveData(metadata) }),
  debug: (message: string, metadata?: unknown) =>
    logger.debug(message, { category: 'system', ...redactSensitiveData(metadata) }),
};

export const authLogger = {
  info: (message: string, metadata?: unknown) =>
    logger.info(message, { category: 'auth', ...redactSensitiveData(metadata) }),
  error: (message: string, metadata?: unknown) =>
    logger.error(message, { category: 'auth', ...redactSensitiveData(metadata) }),
  warn: (message: string, metadata?: unknown) =>
    logger.warn(message, { category: 'auth', ...redactSensitiveData(metadata) }),
  debug: (message: string, metadata?: unknown) =>
    logger.debug(message, { category: 'auth', ...redactSensitiveData(metadata) }),
};

export const apiLogger = {
  info: (message: string, metadata?: unknown) =>
    logger.info(message, { category: 'api', ...redactSensitiveData(metadata) }),
  error: (message: string, metadata?: unknown) =>
    logger.error(message, { category: 'api', ...redactSensitiveData(metadata) }),
  warn: (message: string, metadata?: unknown) =>
    logger.warn(message, { category: 'api', ...redactSensitiveData(metadata) }),
  http: (message: string, metadata?: unknown) =>
    logger.http(message, { category: 'api', ...redactSensitiveData(metadata) }),
  debug: (message: string, metadata?: unknown) =>
    logger.debug(message, { category: 'api', ...redactSensitiveData(metadata) }),
};

export const dbLogger = {
  info: (message: string, metadata?: unknown) =>
    logger.info(message, { category: 'database', ...redactSensitiveData(metadata) }),
  error: (message: string, metadata?: unknown) =>
    logger.error(message, { category: 'database', ...redactSensitiveData(metadata) }),
  warn: (message: string, metadata?: unknown) =>
    logger.warn(message, { category: 'database', ...redactSensitiveData(metadata) }),
  debug: (message: string, metadata?: unknown) =>
    logger.debug(message, { category: 'database', ...redactSensitiveData(metadata) }),
};

export const businessLogger = {
  info: (message: string, metadata?: unknown) =>
    logger.info(message, { category: 'business', ...redactSensitiveData(metadata) }),
  error: (message: string, metadata?: unknown) =>
    logger.error(message, { category: 'business', ...redactSensitiveData(metadata) }),
  warn: (message: string, metadata?: unknown) =>
    logger.warn(message, { category: 'business', ...redactSensitiveData(metadata) }),
  debug: (message: string, metadata?: unknown) =>
    logger.debug(message, { category: 'business', ...redactSensitiveData(metadata) }),
};

export const securityLogger = {
  info: (message: string, metadata?: unknown) =>
    logger.info(message, { category: 'security', ...redactSensitiveData(metadata) }),
  error: (message: string, metadata?: unknown) =>
    logger.error(message, { category: 'security', ...redactSensitiveData(metadata) }),
  warn: (message: string, metadata?: unknown) =>
    logger.warn(message, { category: 'security', ...redactSensitiveData(metadata) }),
  critical: (message: string, metadata?: unknown) =>
    logger.error(message, { category: 'security', critical: true, ...redactSensitiveData(metadata) }),
};

export const perfLogger = {
  log: (message: string, metadata?: unknown) =>
    logger.log('perf', message, { category: 'performance', ...redactSensitiveData(metadata) }),
  slow: (operation: string, duration: number, threshold: number, metadata?: unknown) => {
    if (duration > threshold) {
      logger.warn(`Slow operation detected: ${operation}`, {
        category: 'performance',
        operation,
        duration,
        threshold,
        ...redactSensitiveData(metadata),
      });
    }
  },
};

// Export main logger with redaction wrapper
const exportedLogger = {
  ...logger,
  info: (message: string, metadata?: unknown) =>
    logger.info(message, redactSensitiveData(metadata)),
  error: (message: string, metadata?: unknown) =>
    logger.error(message, redactSensitiveData(metadata)),
  warn: (message: string, metadata?: unknown) =>
    logger.warn(message, redactSensitiveData(metadata)),
  http: (message: string, metadata?: unknown) =>
    logger.http(message, redactSensitiveData(metadata)),
  debug: (message: string, metadata?: unknown) =>
    logger.debug(message, redactSensitiveData(metadata)),
  verbose: (message: string, metadata?: unknown) =>
    logger.verbose(message, redactSensitiveData(metadata)),
};

export default exportedLogger;

// Log system startup
systemLogger.info('Logging system initialized', {
  logLevel: process.env.LOG_LEVEL || 'info',
  logDir,
  environment: process.env.NODE_ENV,
  pid: process.pid,
});