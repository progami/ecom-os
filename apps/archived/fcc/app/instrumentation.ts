/**
 * Next.js Instrumentation API
 * This file is loaded once when the server starts
 * Used to initialize BullMQ workers
 */

// Track if we've already initialized to prevent double initialization
let initialized = false;

export async function register() {
  console.log('[Instrumentation] Register function called', {
    runtime: process.env.NEXT_RUNTIME,
    initialized,
    env: process.env.NODE_ENV
  });
  
  if (process.env.NEXT_RUNTIME === 'nodejs' && !initialized) {
    initialized = true;
    
    // Only run on server, not on edge runtime
    const { structuredLogger } = await import('@/lib/logger');
    
    console.log('[Instrumentation] Conditions met, starting initialization');
    structuredLogger.info('[Instrumentation] Starting application initialization');
    
    // IMPORTANT: Workers are now run in a separate process to prevent server restarts
    // Use 'npm run dev' which runs both server and workers, or run them separately:
    // - npm run dev:server (for Next.js only)
    // - npm run workers:dev (for workers only)
    
    structuredLogger.info('[Instrumentation] Workers should be running in separate process');
  }
}