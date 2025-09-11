import { redis } from './redis';
import { structuredLogger } from './logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key?: string; // Custom cache key
  tenantId: string;
}

export class XeroApiCache {
  private static readonly DEFAULT_TTL = 300; // 5 minutes
  private static readonly CACHE_PREFIX = 'xero:api:cache:';
  
  // Cache TTLs for different resources
  static readonly TTL = {
    GL_ACCOUNTS: 3600,     // 1 hour - GL accounts don't change often
    CHART_OF_ACCOUNTS: 3600, // 1 hour
    TAX_RATES: 7200,       // 2 hours - tax rates rarely change
    TRACKING_CATEGORIES: 1800, // 30 minutes
    ORGANISATIONS: 3600,   // 1 hour
    REPORTS: 300,          // 5 minutes - reports can change frequently
    TRANSACTIONS: 60,      // 1 minute - transactions change frequently
    CONTACTS: 600,         // 10 minutes
    ITEMS: 1800,          // 30 minutes
  };

  private static generateCacheKey(
    resource: string, 
    tenantId: string, 
    params?: Record<string, any>
  ): string {
    const baseKey = `${this.CACHE_PREFIX}${tenantId}:${resource}`;
    
    if (!params || Object.keys(params).length === 0) {
      return baseKey;
    }
    
    // Sort params for consistent cache keys
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join(':');
    
    return `${baseKey}:${sortedParams}`;
  }

  static async get<T>(
    resource: string,
    options: CacheOptions,
    params?: Record<string, any>
  ): Promise<T | null> {
    try {
      const cacheKey = options.key || this.generateCacheKey(resource, options.tenantId, params);
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        structuredLogger.debug('Cache hit', {
          component: 'xero-api-cache',
          resource,
          cacheKey
        });
        return JSON.parse(cached);
      }
      
      structuredLogger.debug('Cache miss', {
        component: 'xero-api-cache',
        resource,
        cacheKey
      });
      return null;
    } catch (error) {
      structuredLogger.error('Cache get error', error, {
        component: 'xero-api-cache',
        resource
      });
      return null; // Don't fail the request if cache fails
    }
  }

  static async set<T>(
    resource: string,
    data: T,
    options: CacheOptions,
    params?: Record<string, any>
  ): Promise<void> {
    try {
      const cacheKey = options.key || this.generateCacheKey(resource, options.tenantId, params);
      const ttl = options.ttl || this.DEFAULT_TTL;
      
      await redis.setex(
        cacheKey,
        ttl,
        JSON.stringify(data)
      );
      
      structuredLogger.debug('Cache set', {
        component: 'xero-api-cache',
        resource,
        cacheKey,
        ttl
      });
    } catch (error) {
      structuredLogger.error('Cache set error', error, {
        component: 'xero-api-cache',
        resource
      });
      // Don't fail the request if cache fails
    }
  }

  static async invalidate(
    resource: string,
    tenantId: string,
    params?: Record<string, any>
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(resource, tenantId, params);
      await redis.del(cacheKey);
      
      structuredLogger.debug('Cache invalidated', {
        component: 'xero-api-cache',
        resource,
        cacheKey
      });
    } catch (error) {
      structuredLogger.error('Cache invalidation error', error, {
        component: 'xero-api-cache',
        resource
      });
    }
  }

  static async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(`${this.CACHE_PREFIX}${pattern}`);
      
      if (keys.length > 0) {
        await redis.del(...keys);
        structuredLogger.info('Cache pattern invalidated', {
          component: 'xero-api-cache',
          pattern,
          keysInvalidated: keys.length
        });
      }
    } catch (error) {
      structuredLogger.error('Cache pattern invalidation error', error, {
        component: 'xero-api-cache',
        pattern
      });
    }
  }

  static async invalidateTenant(tenantId: string): Promise<void> {
    await this.invalidatePattern(`${tenantId}:*`);
  }

  static async withCache<T>(
    resource: string,
    options: CacheOptions,
    fetcher: () => Promise<T>,
    params?: Record<string, any>
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(resource, options, params);
    if (cached !== null) {
      return cached;
    }
    
    // Fetch from API
    const data = await fetcher();
    
    // Store in cache
    await this.set(resource, data, options, params);
    
    return data;
  }
}