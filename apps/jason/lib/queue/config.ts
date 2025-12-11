import { redis } from '@/lib/redis';
import { QueueOptions } from 'bullmq';

export const QUEUE_NAMES = {
  CALENDAR_SYNC: 'calendar-sync',
  WEBHOOK_PROCESSING: 'webhook-processing',
  CONFLICT_DETECTION: 'conflict-detection',
  NOTIFICATION: 'notification',
} as const;

export const defaultQueueOptions: QueueOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: redis as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 1000,
      age: 7 * 24 * 3600, // 7 days
    },
  },
};

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];