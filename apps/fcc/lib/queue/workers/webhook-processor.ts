import { Worker, Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { structuredLogger } from '@/lib/logger';
import { createRedisConnection, QUEUE_NAMES, WebhookProcessingJob, getQueue } from '../queue-config';
import crypto from 'crypto';

/**
 * Webhook event processors
 */
const eventProcessors = {
  async INVOICE(client: any, tenantId: string, resourceId: string, eventType: string) {
    if (eventType === 'Delete') {
      await prisma.syncedInvoice.deleteMany({
        where: { id: resourceId }
      });
      return;
    }

    // Instead of fetching from Xero, queue an incremental sync for this specific invoice
    const incrementalSyncQueue = getQueue('incremental-sync');
    await incrementalSyncQueue.add('sync-single-invoice', {
      resourceType: 'invoice',
      resourceId: resourceId,
      eventType: eventType,
      tenantId: tenantId,
      source: 'webhook'
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });

    structuredLogger.info('Invoice webhook queued for incremental sync', {
      component: 'webhook-processor',
      invoiceId: resourceId,
      eventType,
      source: 'webhook'
    });
  },

  async CONTACT(client: any, tenantId: string, resourceId: string, eventType: string) {
    // Skip contact events as we don't have a Contact model
    structuredLogger.info('Contact webhook skipped - no Contact model', {
      component: 'webhook-processor',
      contactId: resourceId,
      eventType
    });
  },

  async PAYMENT(client: any, tenantId: string, resourceId: string, eventType: string) {
    // Queue payment sync instead of fetching from Xero
    const incrementalSyncQueue = getQueue('incremental-sync');
    await incrementalSyncQueue.add('sync-single-payment', {
      resourceType: 'payment',
      resourceId: resourceId,
      eventType: eventType,
      tenantId: tenantId,
      source: 'webhook'
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });

    structuredLogger.info('Payment webhook queued for incremental sync', {
      component: 'webhook-processor',
      paymentId: resourceId,
      eventType,
      source: 'webhook'
    });
  },

  async BANKTRANSACTION(client: any, tenantId: string, resourceId: string, eventType: string) {
    if (eventType === 'Delete') {
      await prisma.bankTransaction.deleteMany({
        where: { xeroTransactionId: resourceId }
      });
      return;
    }

    // Queue bank transaction sync instead of fetching from Xero
    const incrementalSyncQueue = getQueue('incremental-sync');
    await incrementalSyncQueue.add('sync-single-bank-transaction', {
      resourceType: 'bankTransaction',
      resourceId: resourceId,
      eventType: eventType,
      tenantId: tenantId,
      source: 'webhook'
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });

    structuredLogger.info('Bank transaction webhook queued for incremental sync', {
      component: 'webhook-processor',
      transactionId: resourceId,
      eventType,
      source: 'webhook'
    });
  },

  async BANKACCOUNT(client: any, tenantId: string, resourceId: string, eventType: string) {
    if (eventType === 'Delete') {
      await prisma.bankAccount.deleteMany({
        where: { xeroAccountId: resourceId }
      });
      return;
    }

    // Queue bank account sync instead of fetching from Xero
    const incrementalSyncQueue = getQueue('incremental-sync');
    await incrementalSyncQueue.add('sync-single-bank-account', {
      resourceType: 'bankAccount',
      resourceId: resourceId,
      eventType: eventType,
      tenantId: tenantId,
      source: 'webhook'
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });

    structuredLogger.info('Bank account webhook queued for incremental sync', {
      component: 'webhook-processor',
      accountId: resourceId,
      eventType,
      source: 'webhook'
    });
  }
};

/**
 * Process a single webhook event
 */
async function processWebhookEvent(job: Job<WebhookProcessingJob>) {
  const { eventType, payload, retryCount = 0 } = job.data;
  
  const xeroData = await getXeroClientWithTenant();
  if (!xeroData) {
    throw new Error('No Xero client available for webhook processing');
  }

  const { client, tenantId } = xeroData;
  const { eventCategory, resourceId } = payload;
  
  // Check if we have a processor for this event category
  const processor = eventProcessors[eventCategory as keyof typeof eventProcessors];
  if (!processor) {
    structuredLogger.warn('No processor for webhook event category', {
      component: 'webhook-processor',
      eventCategory,
      eventType,
      resourceId
    });
    return;
  }

  // Process the event
  await processor(client, tenantId, resourceId, eventType);
  
  // Update job progress
  await job.updateProgress(100);
}

/**
 * Create and configure the webhook processing worker
 */
export function createWebhookProcessor() {
  const worker = new Worker<WebhookProcessingJob>(
    QUEUE_NAMES.WEBHOOK_PROCESSING,
    async (job) => {
      const startTime = Date.now();
      
      structuredLogger.info('Processing webhook job', {
        component: 'webhook-processor',
        jobId: job.id,
        eventType: job.data.eventType,
        attempt: job.attemptsMade + 1
      });

      try {
        await processWebhookEvent(job);
        
        const duration = Date.now() - startTime;
        structuredLogger.info('Webhook job completed', {
          component: 'webhook-processor',
          jobId: job.id,
          duration
        });
        
        return { success: true, duration };
      } catch (error) {
        const duration = Date.now() - startTime;
        structuredLogger.error('Webhook job failed', error as Error, {
          component: 'webhook-processor',
          jobId: job.id,
          duration,
          attempt: job.attemptsMade + 1
        });
        
        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 5, // Process up to 5 webhooks in parallel
      limiter: {
        max: 10,
        duration: 1000 // Max 10 jobs per second
      }
    }
  );

  worker.on('completed', (job) => {
    structuredLogger.info('Webhook worker completed job', {
      component: 'webhook-processor',
      jobId: job.id,
      returnValue: job.returnvalue
    });
  });

  worker.on('failed', (job, err) => {
    structuredLogger.error('Webhook worker job failed', err, {
      component: 'webhook-processor',
      jobId: job?.id,
      failedReason: job?.failedReason
    });
  });

  worker.on('error', (err) => {
    structuredLogger.error('Webhook worker error', err, {
      component: 'webhook-processor'
    });
  });

  return worker;
}

// Export for use in process managers
export default createWebhookProcessor;