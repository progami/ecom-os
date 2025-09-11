import { NextRequest, NextResponse } from 'next/server';
import { getQueue } from '@/lib/queue/queue-config';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';
import { structuredLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withAuthValidation(
  { authLevel: ValidationLevel.USER },
  async (request, { session }) => {
    try {
      const queue = getQueue('historical-sync');
      
      // Get job counts
      const jobCounts = await queue.getJobCounts();
      
      // Get recent jobs
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaiting(0, 10),
        queue.getActive(0, 10),
        queue.getCompleted(0, 10),
        queue.getFailed(0, 10)
      ]);

      return NextResponse.json({
        queue: 'historical-sync',
        counts: jobCounts,
        jobs: {
          waiting: waiting.map(job => ({
            id: job.id,
            data: job.data,
            timestamp: job.timestamp,
            priority: job.opts.priority
          })),
          active: active.map(job => ({
            id: job.id,
            data: job.data,
            timestamp: job.timestamp,
            progress: job.progress
          })),
          completed: completed.map(job => ({
            id: job.id,
            data: job.data,
            timestamp: job.timestamp,
            finishedOn: job.finishedOn,
            returnvalue: job.returnvalue
          })),
          failed: failed.map(job => ({
            id: job.id,
            data: job.data,
            timestamp: job.timestamp,
            failedReason: job.failedReason,
            attemptsMade: job.attemptsMade
          }))
        }
      });

    } catch (error: any) {
      structuredLogger.error('[Queue Status API] Failed to fetch queue status', error, {
        errorMessage: error.message,
        errorStack: error.stack
      });
      return NextResponse.json(
        { error: 'Failed to fetch queue status', message: error.message },
        { status: 500 }
      );
    }
  }
);