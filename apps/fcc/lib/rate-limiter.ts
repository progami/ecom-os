import { NextRequest, NextResponse } from 'next/server';
import { structuredLogger } from './logger';
import { redis } from './redis';

// Enhanced rate limiter with Redis support
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private inMemoryStore: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private useRedis: boolean = false;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);

    // Check if Redis is available
    this.checkRedisAvailability();
  }

  private async checkRedisAvailability() {
    try {
      await redis.ping();
      this.useRedis = true;
      structuredLogger.info('Rate limiter using Redis');
    } catch (error) {
      this.useRedis = false;
      structuredLogger.warn('Rate limiter falling back to in-memory store', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private cleanup() {
    if (!this.useRedis) {
      const now = Date.now();
      for (const [key, entry] of this.inMemoryStore.entries()) {
        if (entry.resetTime < now) {
          this.inMemoryStore.delete(key);
        }
      }
    }
    // Redis handles TTL automatically
  }

  private getKey(identifier: string, endpoint: string): string {
    return `ratelimit:${identifier}:${endpoint}`;
  }

  async check(
    identifier: string,
    endpoint: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = this.getKey(identifier, endpoint);
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const resetTime = (window + 1) * windowMs;

    if (this.useRedis) {
      try {
        // Use Redis with sliding window approach
        const redisKey = `${key}:${window}`;
        const ttl = Math.ceil(windowMs / 1000);

        // Increment counter
        const count = await redis.incr(redisKey);
        
        // Set expiry on first increment
        if (count === 1) {
          await redis.expire(redisKey, ttl);
        }

        const allowed = count <= limit;
        const remaining = Math.max(0, limit - count);

        return { allowed, remaining, resetTime };
      } catch (error) {
        // Fallback to in-memory on Redis error
        structuredLogger.error('Redis rate limit error, falling back to in-memory', error);
        this.useRedis = false;
      }
    }

    // In-memory fallback
    let entry = this.inMemoryStore.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry
      entry = { count: 0, resetTime };
      this.inMemoryStore.set(key, entry);
    }

    entry.count++;
    const allowed = entry.count <= limit;
    const remaining = Math.max(0, limit - entry.count);

    return {
      allowed,
      remaining,
      resetTime: entry.resetTime
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

// Rate limit configurations per endpoint
// Based on Xero API limits:
// - 60 calls per minute (rolling window)
// - 5,000 calls per day (rolling 24-hour window, resets at midnight UTC)
// - 5 concurrent requests maximum
// - 10,000 calls per minute across all tenants (app-wide limit)
// 
// Updated for new Xero-first architecture with intelligent caching:
// - Higher limits for cached report endpoints
// - Conservative limits for direct Xero API calls
// - Priority-based limiting for critical vs routine operations
const RATE_LIMITS = {
  // Authentication endpoints - strict limits to prevent abuse
  '/api/v1/xero/auth': { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 minutes
  '/api/v1/xero/auth/callback': { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 per 15 minutes
  '/api/v1/xero/disconnect': { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 minutes

  // Enhanced report endpoints with caching - higher limits due to cache efficiency
  '/api/v1/xero/reports/cash-flow': { limit: 40, windowMs: 60 * 1000 }, // 40 per minute (cache + refresh)
  '/api/v1/xero/reports/aged-receivables': { limit: 30, windowMs: 60 * 1000 }, // 30 per minute (slower changing)
  '/api/v1/xero/reports/aged-payables': { limit: 30, windowMs: 60 * 1000 }, // 30 per minute (slower changing)
  '/api/v1/xero/reports/bank-summary': { limit: 35, windowMs: 60 * 1000 }, // 35 per minute (moderate change)
  '/api/v1/xero/reports/financial-overview': { limit: 25, windowMs: 60 * 1000 }, // 25 per minute (combines multiple APIs)
  '/api/v1/xero/reports/balance-sheet': { limit: 35, windowMs: 60 * 1000 }, // 35 per minute (enhanced with cache)
  '/api/v1/xero/reports/profit-loss': { limit: 35, windowMs: 60 * 1000 }, // 35 per minute (enhanced with cache)
  '/api/v1/xero/reports/vat-liability': { limit: 50, windowMs: 60 * 1000 }, // 50 per minute (less frequent changes)

  // Cache management endpoints - moderate limits
  '/api/v1/xero/reports/cache/status': { limit: 20, windowMs: 60 * 1000 }, // 20 per minute (monitoring)
  '/api/v1/xero/reports/cache/warm': { limit: 5, windowMs: 60 * 1000 }, // 5 per minute (resource intensive)

  // Legacy report endpoints - maintained for backward compatibility
  '/api/v1/xero/reports': { limit: 25, windowMs: 60 * 1000 }, // 25 per minute (increased from 20)

  // Sync endpoints - conservative limits for direct Xero API calls
  '/api/v1/xero/sync': { limit: 25, windowMs: 60 * 1000 }, // 25 per minute (reduced to leave room for reports)
  '/api/v1/xero/sync/full': { limit: 15, windowMs: 60 * 1000 }, // 15 per minute (resource intensive)
  
  // Other Xero endpoints - balanced limits
  '/api/v1/xero/status': { limit: 40, windowMs: 60 * 1000 }, // 40 per minute (lightweight)
  '/api/v1/xero/invoices': { limit: 20, windowMs: 60 * 1000 }, // 20 per minute (direct API)
  '/api/v1/xero/transactions': { limit: 20, windowMs: 60 * 1000 }, // 20 per minute (direct API)

  // Trial balance endpoints
  '/api/v1/xero/trial-balance': { limit: 30, windowMs: 60 * 1000 }, // 30 per minute
  '/api/v1/xero/trial-balance-all': { limit: 25, windowMs: 60 * 1000 }, // 25 per minute (more data)

  // Local endpoints - higher limits (no Xero API dependency)
  '/api/v1/database/status': { limit: 80, windowMs: 60 * 1000 }, // 80 per minute (increased)
  '/api/v1/bookkeeping': { limit: 100, windowMs: 60 * 1000 }, // 100 per minute (local DB + cache)
  '/api/v1/analytics': { limit: 80, windowMs: 60 * 1000 }, // 80 per minute (some may use Xero)

  // Queue endpoints - moderate limits
  '/api/v1/queue': { limit: 30, windowMs: 60 * 1000 }, // 30 per minute

  // Default for all other endpoints
  default: { limit: 120, windowMs: 60 * 1000 } // 120 per minute (increased default)
};

export interface RateLimitOptions {
  identifier?: string;
  limit?: number;
  windowMs?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: RateLimitOptions = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const pathname = req.nextUrl.pathname;
    
    // Get identifier (IP address or user ID)
    const identifier = options.identifier || 
      req.headers.get('x-forwarded-for')?.split(',')[0] || 
      req.headers.get('x-real-ip') || 
      'anonymous';

    // Find matching rate limit config
    let config = RATE_LIMITS.default;
    for (const [path, limits] of Object.entries(RATE_LIMITS)) {
      if (pathname.startsWith(path)) {
        config = limits;
        break;
      }
    }

    // Override with custom options if provided
    const limit = options.limit || config.limit;
    const windowMs = options.windowMs || config.windowMs;

    // Check rate limit
    const result = await rateLimiter.check(identifier, pathname, limit, windowMs);

    // Add rate limit headers
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', limit.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      structuredLogger.warn('Rate limit exceeded', {
        component: 'rate-limiter',
        identifier,
        endpoint: pathname,
        limit,
        windowMs
      });

      return new NextResponse(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        }),
        {
          status: 429,
          headers: {
            ...Object.fromEntries(headers),
            'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
            'Content-Type': 'application/json'
          }
        }
      );
    }

    try {
      // Call the original handler
      const response = await handler(req);

      // Copy rate limit headers to response if response exists
      if (response && response.headers) {
        headers.forEach((value, key) => {
          response.headers.set(key, value);
        });
      }

      return response;
    } catch (error) {
      // Still count failed requests unless skipFailedRequests is true
      if (!options.skipFailedRequests) {
        structuredLogger.error('Request failed after rate limit check', error, {
          component: 'rate-limiter',
          endpoint: pathname
        });
      }
      
      // Re-throw the error so it can be handled by the global error handler
      throw error;
    } finally {
      // In case the error handler returns a response, try to add headers
      // This is wrapped in try-catch to prevent secondary errors
      try {
        if (headers && (headers as unknown as Map<string, string>).size > 0) {
          // Headers will be added by the error handler if it creates a response
        }
      } catch (e) {
        // Ignore header errors in finally block
      }
    }
  };
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    rateLimiter.destroy();
  });
}

// Export Bottleneck for use in other modules
export { default as Bottleneck } from 'bottleneck';