// Client-safe logger that works in both client and server environments
// This logger ONLY uses console methods and has no Node.js dependencies

interface LogLevel {
  DEBUG: 'DEBUG';
  INFO: 'INFO';
  WARN: 'WARN';
  ERROR: 'ERROR';
}

const LOG_LEVELS: LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

class ClientSafeLogger {
  private formatMessage(level: string, module: string, message: string): string {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    return `[${timestamp}] [${module}] [${level}] - ${message}`;
  }

  private log(level: string, message: string, ...args: any[]) {
    // Extract module name from message if it follows pattern [Module]
    const moduleMatch = message.match(/^\[([^\]]+)\]/);
    const moduleName = moduleMatch ? moduleMatch[1] : 'App';
    const cleanMessage = moduleMatch ? message.substring(moduleMatch[0].length).trim() : message;
    const formattedMessage = this.formatMessage(level, moduleName, cleanMessage);
    
    switch (level) {
      case LOG_LEVELS.ERROR:
        console.error(formattedMessage, ...args);
        break;
      case LOG_LEVELS.WARN:
        console.warn(formattedMessage, ...args);
        break;
      case LOG_LEVELS.INFO:
        console.info(formattedMessage, ...args);
        break;
      case LOG_LEVELS.DEBUG:
        if (process.env.NODE_ENV === 'development') {
          console.log(formattedMessage, ...args);
        }
        break;
    }
  }

  debug(message: string, ...args: any[]) {
    this.log(LOG_LEVELS.DEBUG, message, ...args);
  }

  info(message: string, ...args: any[]) {
    this.log(LOG_LEVELS.INFO, message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log(LOG_LEVELS.WARN, message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.log(LOG_LEVELS.ERROR, message, ...args);
  }

  // Add methods for compatibility with structuredLogger interface
  http(message: string, ...args: any[]) {
    this.log(LOG_LEVELS.INFO, message, ...args);
  }

  child(context: any) {
    // Return same instance for simplicity in client
    return this;
  }
}

// Export singleton instance
export const clientSafeLogger = new ClientSafeLogger();

// Also export as structuredLogger and universalLogger for compatibility
export { clientSafeLogger as structuredLogger };
export { clientSafeLogger as universalLogger };