import { structuredLogger } from '@/lib/logger';

// Use a global flag to prevent multiple initializations across module reloads
const WORKER_INIT_KEY = '__QUEUE_WORKERS_INITIALIZED__';

export async function initializeQueueWorkers() {
  console.log('[Queue Init] initializeQueueWorkers called', {
    isServer: typeof window === 'undefined',
    alreadyInit: (global as any)[WORKER_INIT_KEY]
  });
  
  // Only initialize on server-side
  if (typeof window !== 'undefined') {
    console.log('[Queue Init] Running in browser, skipping');
    return;
  }

  // Check if already initialized using global flag
  if ((global as any)[WORKER_INIT_KEY]) {
    structuredLogger.info('[Queue Init] Queue workers already initialized, skipping');
    return;
  }

  try {
    console.log('[Queue Init] Starting worker initialization');
    const { startWorkers } = await import('./workers');
    await startWorkers();
    
    // Mark as initialized globally
    (global as any)[WORKER_INIT_KEY] = true;
    
    structuredLogger.info('[Queue Init] Queue workers initialized');
  } catch (error) {
    structuredLogger.error('[Queue Init] Failed to initialize queue workers', error);
  }
}