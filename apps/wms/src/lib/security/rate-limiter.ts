import { NextRequest } from 'next/server';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: NextRequest) => string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (entry.resetTime < now) {
          this.store.delete(key);
        }
      }
    }, 60000);
  }

  async limit(config: RateLimitConfig, req: NextRequest): Promise<{ allowed: boolean; retryAfter?: number }> {
    const key = config.keyGenerator ? config.keyGenerator(req) : this.getDefaultKey(req);
    const now = Date.now();
    
    let entry = this.store.get(key);
    
    if (!entry || entry.resetTime < now) {
      // Create new entry
      entry = {
        count: 1,
        resetTime: now + config.windowMs
      };
      this.store.set(key, entry);
      return { allowed: true };
    }
    
    // Increment count
    entry.count++;
    
    if (entry.count > config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      return { allowed: false, retryAfter };
    }
    
    return { allowed: true };
  }

  private getDefaultKey(req: NextRequest): string {
    // Use IP address as default key
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
    return `${req.method}:${req.nextUrl.pathname}:${ip}`;
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton instance
let rateLimiterInstance: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter();
  }
  return rateLimiterInstance;
}

// Preset configurations
export const rateLimitConfigs = {
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50, // Increased for testing - 50 attempts per 15 minutes
    keyGenerator: (req: NextRequest) => {
      const email = req.headers.get('x-user-email') || 'unknown';
      return `auth:${email}`;
    }
  },
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100 // 100 requests per minute
  },
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10 // 10 uploads per hour
  }
};

// Middleware helper
export async function checkRateLimit(
  req: NextRequest, 
  config: RateLimitConfig = rateLimitConfigs.api
): Promise<Response | null> {
  const limiter = getRateLimiter();
  const result = await limiter.limit(config, req);
  
  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        retryAfter: result.retryAfter
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(result.retryAfter || 60)
        }
      }
    );
  }
  
  return null;
}