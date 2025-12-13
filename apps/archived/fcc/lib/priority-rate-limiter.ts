import { redis } from './redis';
import { structuredLogger } from './logger';

export enum RequestPriority {
  CRITICAL = 1,    // User-facing dashboard requests, critical reports
  HIGH = 2,        // Manual report generation, user-initiated actions
  NORMAL = 3,      // Scheduled syncs, background operations
  LOW = 4,         // Cache warming, maintenance operations
}

interface PriorityRateLimitConfig {
  critical: { limit: number; windowMs: number };
  high: { limit: number; windowMs: number };
  normal: { limit: number; windowMs: number };
  low: { limit: number; windowMs: number };
}

interface QueuedRequest {
  id: string;
  priority: RequestPriority;
  timestamp: number;
  resolve: (value: boolean) => void;
  reject: (error: Error) => void;
}

export class PriorityRateLimiter {
  private requestQueue: QueuedRequest[] = [];
  private processing = false;
  private readonly config: PriorityRateLimitConfig;

  constructor(config?: Partial<PriorityRateLimitConfig>) {
    this.config = {
      // Critical requests - highest allocation
      critical: { limit: 30, windowMs: 60 * 1000 },
      // High priority requests
      high: { limit: 20, windowMs: 60 * 1000 },
      // Normal requests - standard allocation
      normal: { limit: 15, windowMs: 60 * 1000 },
      // Low priority requests - minimal allocation
      low: { limit: 5, windowMs: 60 * 1000 },
      ...config
    };

    // Start processing queue
    this.processQueue();
  }

  /**
   * Check if request can proceed based on priority
   */
  async checkRateLimit(
    tenantId: string,
    endpoint: string,
    priority: RequestPriority = RequestPriority.NORMAL
  ): Promise<{ allowed: boolean; remaining: number; queuePosition?: number }> {
    const priorityKey = this.getPriorityKey(priority);
    const config = this.config[priorityKey];
    const key = `priority_rate:${tenantId}:${endpoint}:${priorityKey}`;
    
    try {
      // Check current usage for this priority level
      const now = Date.now();
      const window = Math.floor(now / config.windowMs);
      const redisKey = `${key}:${window}`;
      const ttl = Math.ceil(config.windowMs / 1000);

      // Increment counter
      const count = await redis.incr(redisKey);
      
      // Set expiry on first increment
      if (count === 1) {
        await redis.expire(redisKey, ttl);
      }

      const allowed = count <= config.limit;
      const remaining = Math.max(0, config.limit - count);

      if (allowed) {
        structuredLogger.debug('[Priority Rate Limiter] Request allowed', {
          component: 'priority-rate-limiter',
          tenantId,
          endpoint,
          priority: priorityKey,
          count,
          limit: config.limit,
          remaining
        });

        return { allowed: true, remaining };
      } else {
        // Add to queue if not allowed
        const queuePosition = await this.addToQueue(tenantId, endpoint, priority);
        
        structuredLogger.info('[Priority Rate Limiter] Request queued', {
          component: 'priority-rate-limiter',
          tenantId,
          endpoint,
          priority: priorityKey,
          queuePosition,
          count,
          limit: config.limit
        });

        return { allowed: false, remaining: 0, queuePosition };
      }

    } catch (error) {
      structuredLogger.error('[Priority Rate Limiter] Error checking rate limit', error, {
        component: 'priority-rate-limiter',
        tenantId,
        endpoint,
        priority: this.getPriorityKey(priority)
      });

      // Allow request on error to prevent blocking
      return { allowed: true, remaining: 0 };
    }
  }

  /**
   * Execute function with priority-based rate limiting
   */
  async executeWithPriority<T>(
    operation: () => Promise<T>,
    options: {
      tenantId: string;
      endpoint: string;
      priority: RequestPriority;
      timeout?: number;
    }
  ): Promise<T> {
    const { tenantId, endpoint, priority, timeout = 30000 } = options;

    // Check rate limit
    const rateCheck = await this.checkRateLimit(tenantId, endpoint, priority);

    if (rateCheck.allowed) {
      // Execute immediately
      return await operation();
    } else {
      // Wait in queue
      const canProceed = await this.waitInQueue(
        tenantId,
        endpoint,
        priority,
        timeout
      );

      if (canProceed) {
        return await operation();
      } else {
        throw new Error('Request timed out waiting in priority queue');
      }
    }
  }

  /**
   * Add request to priority queue
   */
  private async addToQueue(
    tenantId: string,
    endpoint: string,
    priority: RequestPriority
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const requestId = `${tenantId}:${endpoint}:${Date.now()}:${Math.random()}`;
      
      const queuedRequest: QueuedRequest = {
        id: requestId,
        priority,
        timestamp: Date.now(),
        resolve: (canProceed: boolean) => {
          if (canProceed) {
            resolve(this.requestQueue.length);
          } else {
            reject(new Error('Request rejected from queue'));
          }
        },
        reject
      };

      // Insert based on priority (lower number = higher priority)
      let insertIndex = this.requestQueue.length;
      for (let i = 0; i < this.requestQueue.length; i++) {
        if (this.requestQueue[i].priority > priority) {
          insertIndex = i;
          break;
        }
      }

      this.requestQueue.splice(insertIndex, 0, queuedRequest);
      
      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Wait for request to be processed from queue
   */
  private async waitInQueue(
    tenantId: string,
    endpoint: string,
    priority: RequestPriority,
    timeout: number
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Queue wait timeout'));
      }, timeout);

      this.addToQueue(tenantId, endpoint, priority)
        .then(() => {
          clearTimeout(timer);
          resolve(true);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.requestQueue.length > 0) {
        const request = this.requestQueue.shift();
        if (!request) continue;

        // Check if this request can now proceed
        const priorityKey = this.getPriorityKey(request.priority);
        const config = this.config[priorityKey];
        
        // Simulate rate limit check (simplified for queue processing)
        const now = Date.now();
        const timeSinceQueued = now - request.timestamp;
        
        // If request has been waiting long enough, allow it
        if (timeSinceQueued > config.windowMs / 4) {
          request.resolve(true);
        } else {
          // Put back in queue and wait
          this.requestQueue.unshift(request);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      structuredLogger.error('[Priority Rate Limiter] Error processing queue', error, {
        component: 'priority-rate-limiter'
      });
    } finally {
      this.processing = false;
      
      // Schedule next processing if queue is not empty
      if (this.requestQueue.length > 0) {
        setTimeout(() => this.processQueue(), 1000);
      }
    }
  }

  /**
   * Get priority key string
   */
  private getPriorityKey(priority: RequestPriority): keyof PriorityRateLimitConfig {
    switch (priority) {
      case RequestPriority.CRITICAL:
        return 'critical';
      case RequestPriority.HIGH:
        return 'high';
      case RequestPriority.NORMAL:
        return 'normal';
      case RequestPriority.LOW:
        return 'low';
      default:
        return 'normal';
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    queueLength: number;
    priorityBreakdown: Record<string, number>;
    oldestRequest: number | null;
    averageWaitTime: number;
  }> {
    const priorityBreakdown: Record<string, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0
    };

    let oldestTimestamp: number | null = null;
    let totalWaitTime = 0;
    const now = Date.now();

    for (const request of this.requestQueue) {
      const priorityKey = this.getPriorityKey(request.priority);
      priorityBreakdown[priorityKey]++;
      
      if (!oldestTimestamp || request.timestamp < oldestTimestamp) {
        oldestTimestamp = request.timestamp;
      }
      
      totalWaitTime += now - request.timestamp;
    }

    return {
      queueLength: this.requestQueue.length,
      priorityBreakdown,
      oldestRequest: oldestTimestamp,
      averageWaitTime: this.requestQueue.length > 0 ? 
        totalWaitTime / this.requestQueue.length : 0
    };
  }

  /**
   * Clear queue (emergency use)
   */
  clearQueue(): number {
    const clearedCount = this.requestQueue.length;
    
    // Reject all queued requests
    for (const request of this.requestQueue) {
      request.reject(new Error('Queue cleared'));
    }
    
    this.requestQueue = [];
    
    structuredLogger.warn('[Priority Rate Limiter] Queue cleared', {
      component: 'priority-rate-limiter',
      clearedCount
    });
    
    return clearedCount;
  }
}

// Global priority rate limiter instance
export const priorityRateLimiter = new PriorityRateLimiter();

// Helper function to determine priority based on request context
export function determinePriority(
  endpoint: string,
  userAgent?: string,
  isRefresh?: boolean
): RequestPriority {
  // Critical: User-facing dashboard requests
  if (endpoint.includes('/financial-overview') || 
      endpoint.includes('/balance-sheet') ||
      endpoint.includes('/profit-loss')) {
    return RequestPriority.CRITICAL;
  }

  // High: Manual user actions
  if (isRefresh || 
      userAgent?.includes('Chrome') || 
      userAgent?.includes('Firefox') ||
      endpoint.includes('/aged-')) {
    return RequestPriority.HIGH;
  }

  // Low: Cache warming and maintenance
  if (endpoint.includes('/cache/warm') ||
      endpoint.includes('/sync/full')) {
    return RequestPriority.LOW;
  }

  // Normal: Everything else
  return RequestPriority.NORMAL;
}