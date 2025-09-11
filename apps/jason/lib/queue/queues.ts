import { Queue } from 'bullmq';
import { QUEUE_NAMES, defaultQueueOptions } from './config';
import { redis } from '@/lib/redis';

let calendarSyncQueue: Queue | null = null;
let webhookQueue: Queue | null = null;
let conflictQueue: Queue | null = null;
let notificationQueue: Queue | null = null;

if (redis) {
  try {
    calendarSyncQueue = new Queue(QUEUE_NAMES.CALENDAR_SYNC, defaultQueueOptions);
    webhookQueue = new Queue(QUEUE_NAMES.WEBHOOK_PROCESSING, defaultQueueOptions);
    conflictQueue = new Queue(QUEUE_NAMES.CONFLICT_DETECTION, defaultQueueOptions);
    notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, defaultQueueOptions);
  } catch (error) {
    console.warn('Queue initialization failed (non-fatal):', error);
  }
}

export { calendarSyncQueue, webhookQueue, conflictQueue, notificationQueue };