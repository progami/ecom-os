#!/usr/bin/env node

/**
 * Standalone worker process for BullMQ job processing
 * Run this alongside the Next.js server to process background jobs
 */

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: '.env.local' });
}

async function main() {
  try {
    console.log('Starting BullMQ workers...');
    
    // Use dynamic import for TypeScript files
    const workersModule = await import('./lib/queue/workers/index.js');
    await workersModule.startWorkers();
    
    console.log('BullMQ workers started successfully');
    
    // Keep the process alive
    process.stdin.resume();
    
    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down workers...');
      await workersModule.stopWorkers();
      process.exit(0);
    };
    
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    
  } catch (error) {
    console.error('Failed to start workers:', error);
    process.exit(1);
  }
}

main();