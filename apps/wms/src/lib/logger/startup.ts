import { systemLogger } from './index';
import { logRotator } from './rotation';
import os from 'os';

// Initialize logging system on startup
export function initializeLogging() {
  // Log system information
  systemLogger.info('WMS Server Starting', {
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
    freeMemory: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
    cpus: os.cpus().length,
    pid: process.pid,
    env: process.env.NODE_ENV,
    cwd: process.cwd(),
  });

  // Start log rotation
  logRotator.start();

  // Set up process event handlers
  setupProcessHandlers();

  // Log environment configuration (without sensitive data)
  systemLogger.info('Environment Configuration', {
    logLevel: process.env.LOG_LEVEL || 'info',
    logDir: process.env.LOG_DIR || './logs',
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT || 3000,
    databaseConfigured: !!process.env.DATABASE_URL,
    authConfigured: !!process.env.NEXTAUTH_SECRET,
    amazonConfigured: !!process.env.AMAZON_SP_APP_ID,
  });
}

// Set up handlers for process events
function setupProcessHandlers() {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    systemLogger.error('Uncaught Exception', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      pid: process.pid,
    });
    
    // Give the logger time to write before exiting
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    systemLogger.error('Unhandled Promise Rejection', {
      reason: reason instanceof Error ? {
        name: reason.name,
        message: reason.message,
        stack: reason.stack,
      } : String(reason),
      promise: String(promise),
      pid: process.pid,
    });
  });

  // Handle warnings
  process.on('warning', (warning) => {
    systemLogger.warn('Process Warning', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
      pid: process.pid,
    });
  });

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    systemLogger.info('Received SIGINT, shutting down gracefully', {
      pid: process.pid,
    });
    
    // Stop log rotation
    logRotator.stop();
    
    // Give the logger time to write before exiting
    setTimeout(() => {
      process.exit(0);
    }, 500);
  });

  // Handle SIGTERM
  process.on('SIGTERM', () => {
    systemLogger.info('Received SIGTERM, shutting down gracefully', {
      pid: process.pid,
    });
    
    // Stop log rotation
    logRotator.stop();
    
    // Give the logger time to write before exiting
    setTimeout(() => {
      process.exit(0);
    }, 500);
  });

  // Log process exit
  process.on('exit', (code) => {
    systemLogger.info('Process exiting', {
      exitCode: code,
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    });
  });
}

// Log Next.js server ready
export function logServerReady(port: number | string) {
  systemLogger.info('Next.js server ready', {
    port,
    url: `http://localhost:${port}`,
    pid: process.pid,
    uptime: process.uptime(),
  });
}

// Log database connection
export function logDatabaseConnection(success: boolean, error?: Error) {
  if (success) {
    systemLogger.info('Database connection established', {
      database: 'PostgreSQL',
    });
  } else {
    systemLogger.error('Database connection failed', {
      database: 'PostgreSQL',
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : 'Unknown error',
    });
  }
}

// Export a function to be called in server initialization
export function setupServerLogging() {
  // Initialize logging on import
  initializeLogging();
  
  // Return handlers for Next.js
  return {
    onReady: logServerReady,
    onDatabaseConnect: logDatabaseConnection,
  };
}