#!/usr/bin/env node

/**
 * Standalone worker process for BullMQ job processing
 * Run this alongside the Next.js server to process background jobs
 */

import 'dotenv/config';
import { startWorkers, stopWorkers } from './lib/queue/workers';
import { structuredLogger } from './lib/logger';

async function main() {
  try {
    console.log('='.repeat(60));
    console.log('BullMQ Worker Process Starting');
    console.log('='.repeat(60));
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Redis Host: ${process.env.REDIS_HOST || 'localhost'}`);
    console.log(`Redis Port: ${process.env.REDIS_PORT || '6379'}`);
    console.log('='.repeat(60));
    
    structuredLogger.info('Starting BullMQ workers process', {
      component: 'worker-process',
      env: process.env.NODE_ENV,
      pid: process.pid
    });
    
    await startWorkers();
    
    console.log('\n✅ BullMQ workers started successfully');
    console.log('Workers are now processing jobs...\n');
    
    // Log worker status periodically
    setInterval(() => {
      structuredLogger.info('Worker process heartbeat', {
        component: 'worker-process',
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      });
    }, 60000); // Every minute
    
    // Keep the process alive
    process.stdin.resume();
    
    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('\n⚠️  Shutting down workers...');
      structuredLogger.info('Worker process shutting down', {
        component: 'worker-process'
      });
      
      await stopWorkers();
      
      console.log('✅ Workers stopped successfully');
      process.exit(0);
    };
    
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    
  } catch (error) {
    console.error('❌ Failed to start workers:', error);
    structuredLogger.error('Failed to start worker process', error as Error, {
      component: 'worker-process'
    });
    process.exit(1);
  }
}

main();