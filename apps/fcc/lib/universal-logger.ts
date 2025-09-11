// Universal logger that works on both client and server
// For client-side usage, we re-export the client-safe logger
// For server-side usage, use the logger.ts directly

// Re-export client-safe logger for universal usage
export { universalLogger, structuredLogger } from './client-safe-logger';