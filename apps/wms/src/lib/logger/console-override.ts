/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
  trace: console.trace,
};

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create a write stream for logs/dev.log
const devLogPath = path.join(process.cwd(), 'logs', 'dev.log');
const logStream = fs.createWriteStream(devLogPath, { flags: 'a' });

// Helper function to format log messages
function formatLogMessage(level: string, args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const formattedArgs = args.map(arg => {
    if (typeof arg === 'object') {
      return util.inspect(arg, { depth: null, colors: false });
    }
    return String(arg);
  }).join(' ');
  
  return `${timestamp} [${level.toUpperCase()}]: ${formattedArgs}\n`;
}

// Helper function to write to both console and file
function createLogFunction(level: string, originalMethod: (...args: unknown[]) => void) {
  return function(...args: unknown[]) {
    // Write to original console
    originalMethod.apply(console, args);
    
    // Write to dev.log file
    const logMessage = formatLogMessage(level, args);
    logStream.write(logMessage);
  };
}

// Override console methods
export function overrideConsoleMethods(): void {
  // @ts-ignore - We're intentionally overriding console methods
  console.log = createLogFunction('log', originalConsole.log);
  // @ts-ignore
  console.error = createLogFunction('error', originalConsole.error);
  // @ts-ignore
  console.warn = createLogFunction('warn', originalConsole.warn);
  // @ts-ignore
  console.info = createLogFunction('info', originalConsole.info);
  // @ts-ignore
  console.debug = createLogFunction('debug', originalConsole.debug);
  // @ts-ignore
  console.trace = createLogFunction('trace', originalConsole.trace);

  // Also capture stdout and stderr writes
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = function(chunk: string | Buffer, encodingOrCallback?: BufferEncoding | ((err?: Error) => void), callback?: (err?: Error) => void) {
    if (chunk && chunk.toString) {
      const message = chunk.toString();
      if (message.trim()) {
        const timestamp = new Date().toISOString();
        logStream.write(`${timestamp} [STDOUT]: ${message}`);
      }
    }
    return originalStdoutWrite(chunk, encodingOrCallback, callback);
  } as typeof process.stdout.write;

  process.stderr.write = function(chunk: string | Buffer, encodingOrCallback?: BufferEncoding | ((err?: Error) => void), callback?: (err?: Error) => void) {
    if (chunk && chunk.toString) {
      const message = chunk.toString();
      if (message.trim()) {
        const timestamp = new Date().toISOString();
        logStream.write(`${timestamp} [STDERR]: ${message}`);
      }
    }
    return originalStderrWrite(chunk, encodingOrCallback, callback);
  } as typeof process.stderr.write;

  // Log that console override is active
  const timestamp = new Date().toISOString();
  logStream.write(`\n${timestamp} [SYSTEM]: Console override initialized - All console output will be captured in logs/dev.log\n`);
  logStream.write(`${timestamp} [SYSTEM]: Process ID: ${process.pid}\n`);
  logStream.write(`${timestamp} [SYSTEM]: Node Version: ${process.version}\n`);
  logStream.write(`${timestamp} [SYSTEM]: Working Directory: ${process.cwd()}\n\n`);
}

// Ensure log stream is flushed on exit
process.on('exit', () => {
  logStream.end();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  const timestamp = new Date().toISOString();
  logStream.write(`${timestamp} [UNCAUGHT_EXCEPTION]: ${error.stack || error}\n`);
  logStream.end(() => {
    process.exit(1);
  });
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason: unknown, _promise: Promise<unknown>) => {
  const timestamp = new Date().toISOString();
  logStream.write(`${timestamp} [UNHANDLED_REJECTION]: ${reason}\n`);
});

export { originalConsole, logStream };