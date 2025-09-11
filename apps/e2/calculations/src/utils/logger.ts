// src/utils/logger.ts
// Edge Runtime-compatible logger that uses only console methods

interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

class SimpleLogger implements Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';

  debug(message: string, ...args: any[]) {
    if (this.isDevelopment) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    console.log(`[INFO] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(`[WARN] ${message}`, ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

// Export a singleton instance
const logger = new SimpleLogger();
export default logger;