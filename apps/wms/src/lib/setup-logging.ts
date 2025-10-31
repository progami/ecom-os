/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

// Determine log file based on environment
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_FILE_NAME = IS_PRODUCTION ? 'prod.log' : 'dev.log';
const LOG_PATH = path.join(process.cwd(), 'logs', LOG_FILE_NAME);

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
 fs.mkdirSync(logsDir, { recursive: true });
}

// Create write stream
// In development: 'w' flag clears file on restart
// In production: 'a' flag appends to existing file
const logStream = fs.createWriteStream(LOG_PATH, { 
 flags: IS_PRODUCTION ? 'a' : 'w' 
});

// Helper to format log messages
function formatLog(level: string, args: unknown[]): string {
 const message = args.map(arg => 
 typeof arg === 'object' ? util.inspect(arg, { depth: 3, colors: false }) : String(arg)
 ).join(' ');
 
 // Check if message already has a timestamp (Winston format)
 const hasTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/.test(message);
 
 if (hasTimestamp) {
 // Message already has timestamp from Winston, just add level if not present
 return `${message}\n`;
 } else {
 // Add timestamp for non-Winston logs
 const timestamp = new Date().toISOString();
 return `[${timestamp}] [${level}] ${message}\n`;
 }
}

// Store original console methods
const originalConsole = {
 log: console.log,
 error: console.error,
 warn: console.warn,
 info: console.info,
 debug: console.debug,
};

// Override console methods with proper typing
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;
const originalDebug = console.debug;

// @ts-ignore - We're intentionally overriding console methods
console.log = function(...args: unknown[]) {
 originalLog.apply(console, args);
 logStream.write(formatLog('LOG', args));
};

// @ts-ignore
console.error = function(...args: unknown[]) {
 originalError.apply(console, args);
 logStream.write(formatLog('ERROR', args));
};

// @ts-ignore
console.warn = function(...args: unknown[]) {
 originalWarn.apply(console, args);
 logStream.write(formatLog('WARN', args));
};

// @ts-ignore
console.info = function(...args: unknown[]) {
 originalInfo.apply(console, args);
 logStream.write(formatLog('INFO', args));
};

// @ts-ignore
console.debug = function(...args: unknown[]) {
 originalDebug.apply(console, args);
 logStream.write(formatLog('DEBUG', args));
};

// Log initialization
originalLog(`Logging system initialized - All console output will be written to ${LOG_FILE_NAME}`);

// Handle process events
process.on('uncaughtException', (error: Error) => {
 logStream.write(formatLog('FATAL', [`Uncaught Exception: ${error.message}`, error.stack || '']));
});

process.on('unhandledRejection', (reason: unknown, _promise: Promise<unknown>) => {
 logStream.write(formatLog('ERROR', [`Unhandled Rejection, reason: ${reason}`]));
});

process.on('exit', (code: number) => {
 logStream.write(formatLog('INFO', [`Process exiting with code: ${code}`]));
});

export { logStream, originalConsole };