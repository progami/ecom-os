import { NextRequest, NextResponse } from 'next/server';
import { createRedisConnection } from '@/lib/queue/queue-config';
import { structuredLogger } from '@/lib/logger';

export async function GET() {
  try {
    const redis = createRedisConnection();
    
    // Check if workers are processing by looking at active worker keys
    const workerKeys = await redis.keys('bull:*:workers');
    const activeWorkers = [];
    
    for (const key of workerKeys) {
      const workers = await redis.hgetall(key);
      if (Object.keys(workers).length > 0) {
        activeWorkers.push({
          queue: key.split(':')[1],
          count: Object.keys(workers).length,
          workers: Object.keys(workers)
        });
      }
    }
    
    // Check queue status
    const queueKeys = await redis.keys('bull:*:meta');
    const queues = [];
    
    for (const key of queueKeys) {
      const queueName = key.split(':')[1];
      const [waiting, active, completed, failed] = await Promise.all([
        redis.zcard(`bull:${queueName}:wait`),
        redis.zcard(`bull:${queueName}:active`),
        redis.zcard(`bull:${queueName}:completed`),
        redis.zcard(`bull:${queueName}:failed`)
      ]);
      
      queues.push({
        name: queueName,
        waiting,
        active,
        completed,
        failed
      });
    }
    
    await redis.quit();
    
    const healthy = activeWorkers.length > 0;
    
    return NextResponse.json({
      status: healthy ? 'healthy' : 'unhealthy',
      message: healthy 
        ? 'Workers are running' 
        : 'No active workers detected. Please ensure workers are running with npm run workers:dev',
      activeWorkers,
      queues,
      timestamp: new Date().toISOString()
    }, {
      status: healthy ? 200 : 503
    });
    
  } catch (error) {
    structuredLogger.error('Worker health check failed', error as Error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Failed to check worker health',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}