import winston from 'winston';
import { sanitizeObject, sanitizeString } from './log-sanitizer';
import fs from 'fs';
import path from 'path';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Conditionally import DailyRotateFile only in Node.js runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DailyRotateFile: any;
if (typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    DailyRotateFile = require('winston-daily-rotate-file');
  } catch {
    // Silently ignore in edge runtime
  }
}

// Custom format that sanitizes sensitive data
const sanitizeFormat = winston.format((info) => {
  // Create a new WeakSet for each log entry to track visited objects
  const visited = new WeakSet();
  
  // Sanitize the message
  if (typeof info.message === 'string') {
    info.message = sanitizeString(info.message);
  }
  
  // Sanitize metadata
  if (info.metadata) {
    info.metadata = sanitizeObject(info.metadata, visited);
  }
  
  // Sanitize any additional properties
  const sanitized = { ...info };
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'object' && key !== 'level' && key !== 'timestamp') {
      sanitized[key] = sanitizeObject(sanitized[key], visited);
    }
  });
  
  return sanitized;
});

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Define format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  sanitizeFormat(),
  winston.format.json()
);

// Define transports
const transports: winston.transport[] = [];

// Console transport (development)
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(
          (info) => {
            const timestamp = info.timestamp;
            const level = info.level.toUpperCase();
            const message: string = typeof info.message === 'object'
              ? JSON.stringify(info.message, null, 2)
              : String(info.message ?? '');
            
            // Extract module name from message if it starts with [ModuleName]
            let moduleName = 'Server';
            let cleanMessage = message;
            
            // Check for [CLIENT] prefix
            if (message.startsWith('[CLIENT]')) {
              const afterClient = message.substring('[CLIENT]'.length).trim();
              // Check if there's another module name after [CLIENT]
              const clientModuleMatch = afterClient.match(/^\[([^\]]+)\]/);
              if (clientModuleMatch) {
                moduleName = clientModuleMatch[1];
                cleanMessage = afterClient.substring(clientModuleMatch[0].length).trim();
              } else {
                moduleName = 'Client';
                cleanMessage = afterClient;
              }
            } else {
              // Check for regular module pattern
              const moduleMatch = message.match(/^\[([^\]]+)\]/);
              if (moduleMatch) {
                moduleName = moduleMatch[1];
                cleanMessage = message.substring(moduleMatch[0].length).trim();
              }
            }
            
            // Color coding
            const levelColor = info.level.includes('error') ? '\x1b[31m' : // red
                              info.level.includes('warn') ? '\x1b[33m' : // yellow
                              info.level.includes('info') ? '\x1b[32m' : // green
                              info.level.includes('debug') ? '\x1b[34m' : // blue
                              '\x1b[37m'; // white
            const reset = '\x1b[0m';
            
            return `[${timestamp}] [${moduleName}] ${levelColor}[${level}]${reset} - ${cleanMessage}`;
          }
        )
      ),
    })
  );
}

// Single file transport for development
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
  try {
    const devLogPath = path.join(logsDir, 'development.log');
    
    transports.push(
      new winston.transports.File({
        filename: devLogPath,
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(
            (info) => {
              const level = info.level.toUpperCase();
              const message: string = typeof info.message === 'object'
                ? JSON.stringify(info.message, null, 2)
                : String(info.message ?? '');
              
              // Extract module name from message if it starts with [ModuleName]
              let moduleName = 'Server';
              let cleanMessage = message;
              
              // Check for [CLIENT] prefix
              if (message.startsWith('[CLIENT]')) {
                const afterClient = message.substring('[CLIENT]'.length).trim();
                // Check if there's another module name after [CLIENT]
                const clientModuleMatch = afterClient.match(/^\[([^\]]+)\]/);
                if (clientModuleMatch) {
                  moduleName = clientModuleMatch[1];
                  cleanMessage = afterClient.substring(clientModuleMatch[0].length).trim();
                } else {
                  moduleName = 'Client';
                  cleanMessage = afterClient;
                }
              } else {
                // Check for regular module pattern
                const moduleMatch = message.match(/^\[([^\]]+)\]/);
                if (moduleMatch) {
                  moduleName = moduleMatch[1];
                  cleanMessage = message.substring(moduleMatch[0].length).trim();
                }
              }
              
              return `[${info.timestamp}] [${moduleName}] [${level}] - ${cleanMessage}`;
            }
          )
        ),
        options: { flags: 'a' }, // Append mode
      })
    );
  } catch (e) {
    console.error('Failed to create file transport:', e);
  }
}

// Production file transports - only if DailyRotateFile is available
if (process.env.NODE_ENV === 'production' && DailyRotateFile && typeof window === 'undefined') {
  try {
    const productionFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(
        (info) => {
          const level = info.level.toUpperCase();
          const message: string = typeof info.message === 'object'
            ? JSON.stringify(info.message, null, 2)
            : String(info.message ?? '');

          // Extract module name from message if it starts with [ModuleName]
          let moduleName = 'Server';
          let cleanMessage = message;

          // Check for [CLIENT] prefix
          if (message.startsWith('[CLIENT]')) {
            const afterClient = message.substring('[CLIENT]'.length).trim();
            // Check if there's another module name after [CLIENT]
            const clientModuleMatch = afterClient.match(/^\[([^\]]+)\]/);
            if (clientModuleMatch) {
              moduleName = clientModuleMatch[1];
              cleanMessage = afterClient.substring(clientModuleMatch[0].length).trim();
            } else {
              moduleName = 'Client';
              cleanMessage = afterClient;
            }
          } else {
            // Check for regular module pattern
            const moduleMatch = message.match(/^\[([^\]]+)\]/);
            if (moduleMatch) {
              moduleName = moduleMatch[1];
              cleanMessage = message.substring(moduleMatch[0].length).trim();
            }
          }
          
          return `[${info.timestamp}] [${moduleName}] [${level}] - ${cleanMessage}`;
        }
      )
    );

    // Error log file
    transports.push(
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '30d',
        format: productionFormat,
      })
    );

    // Combined log file
    transports.push(
      new DailyRotateFile({
        filename: 'logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '7d',
        format: productionFormat,
      })
    );
  } catch {
    // Silently ignore if file transport fails
  }
}

// Create logger instance
const createLogger = () => {
  const config: winston.LoggerOptions = {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
    levels,
    format,
    transports,
  };

  // Only add file handlers if we're in Node.js runtime
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    try {
      config.exceptionHandlers = [
        new winston.transports.File({ filename: 'logs/exceptions.log' }),
      ];
      config.rejectionHandlers = [
        new winston.transports.File({ filename: 'logs/rejections.log' }),
      ];
    } catch {
      // Silently ignore if file transport fails (edge runtime)
    }
  }

  return winston.createLogger(config);
};

const logger = createLogger();

// Log initialization in development - only log once per process
if (process.env.NODE_ENV !== 'production' && typeof window === 'undefined') {
  // Use a global flag to ensure we only log startup once
  const globalWithFlag = global as typeof globalThis & { __loggerInitialized?: boolean };
  if (!globalWithFlag.__loggerInitialized) {
    globalWithFlag.__loggerInitialized = true;
    
    // Use setTimeout to ensure the transport is ready
    setTimeout(() => {
      logger.info('');
      logger.info('===============================================');
      logger.info(`=== Server started at ${new Date().toISOString()} ===`);
      logger.info('===============================================');
      logger.info('[Logger] Development logger initialized');
      logger.info(`[Logger] Logging to: console and logs/development.log`);
      logger.info(`[Logger] Log level: ${process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info')}`);
      logger.info(`[Logger] Working directory: ${process.cwd()}`);
      logger.info('');
    }, 100);
  }
}

interface RequestLike {
  url: string;
  method: string;
}

interface ResponseLike {
  statusCode: number;
  on: (event: string, callback: () => void) => void;
}

// Create request logger middleware
export function requestLogger(req: RequestLike, res: ResponseLike, next: () => void) {
  // Skip logging for static assets and health checks
  if (req.url.includes('_next') || req.url.includes('/health') || req.url.includes('/favicon')) {
    return next();
  }
  
  const start = Date.now();
  
  // Only log response, not request (reduces noise)
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const emoji = status >= 500 ? '❌' : status >= 400 ? '⚠️ ' : '✅';
    
    logger.http(`[HTTP] ${emoji} ${req.method} ${req.url} → ${status} (${duration}ms)`);
  });
  
  next();
}

// Export logger with context methods
export class Logger {
  private context: Record<string, unknown> = {};

  constructor(context?: Record<string, unknown>) {
    this.context = context || {};
  }

  private log(level: string, message: string, meta?: Record<string, unknown>) {
    // Format the message with context if available
    let formattedMessage = message;
    
    // If we have a requestId in context, prepend it to the message
    if (this.context.requestId) {
      formattedMessage = `[${this.context.requestId}] ${message}`;
    }
    
    // If there's additional metadata, append it
    if (meta && Object.keys(meta).length > 0) {
      // Remove redundant properties already in context
      const cleanMeta = { ...meta };
      Object.keys(this.context).forEach(key => {
        if (cleanMeta[key] === this.context[key]) {
          delete cleanMeta[key];
        }
      });
      
      if (Object.keys(cleanMeta).length > 0) {
        formattedMessage += ` ${JSON.stringify(cleanMeta)}`;
      }
    }
    
    // Use winston logger directly
    switch (level) {
      case 'error':
        logger.error(formattedMessage);
        break;
      case 'warn':
        logger.warn(formattedMessage);
        break;
      case 'debug':
        logger.debug(formattedMessage);
        break;
      case 'http':
        logger.http(formattedMessage);
        break;
      case 'info':
      default:
        logger.info(formattedMessage);
        break;
    }
  }

  error(message: string, error?: unknown, meta?: Record<string, unknown>) {
    const errorValue = error instanceof Error ? error.stack : error;
    this.log('error', message, { error: errorValue, ...meta });
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log('info', message, meta);
  }

  http(message: string, meta?: Record<string, unknown>) {
    this.log('http', message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.log('debug', message, meta);
  }

  child(context: Record<string, unknown>) {
    return new Logger({ ...this.context, ...context });
  }
}

// Create default logger instance
export const structuredLogger = new Logger();

// Export winston logger instance for advanced usage
export const winstonLogger = logger;

// Export default
export default structuredLogger;