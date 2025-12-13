import { redis } from './redis';
import { structuredLogger } from './logger';

// Report-specific TTL configurations (in seconds)
export const REPORT_TTL = {
  // Fast-changing data - shorter cache
  CASH_FLOW: 15 * 60,        // 15 minutes - cash changes frequently
  CASH_SUMMARY: 15 * 60,     // 15 minutes - detailed cash movements
  BANK_SUMMARY: 30 * 60,     // 30 minutes - moderate frequency
  FINANCIAL_OVERVIEW: 10 * 60, // 10 minutes - combines multiple reports
  
  // Slower-changing data - longer cache
  AGED_RECEIVABLES: 60 * 60,   // 1 hour - receivables change daily
  AGED_PAYABLES: 60 * 60,      // 1 hour - payables change daily
  PROFIT_LOSS: 30 * 60,        // 30 minutes - depends on period
  BALANCE_SHEET: 30 * 60,      // 30 minutes - daily changes
  TRIAL_BALANCE: 60 * 60,      // 1 hour - detailed view
  VAT_LIABILITY: 2 * 60 * 60,  // 2 hours - changes less frequently
} as const;

export type ReportType = keyof typeof REPORT_TTL;

interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  totalRequests: number;
  lastRefresh: string;
}

interface CacheOptions {
  forceRefresh?: boolean;
  backgroundRefresh?: boolean;
  tenantId: string;
  reportType: ReportType;
  params?: Record<string, any>;
}

export class ReportCacheManager {
  
  /**
   * Generate cache key for a report
   */
  private static getCacheKey(tenantId: string, reportType: ReportType, params?: Record<string, any>): string {
    const baseKey = `report:${tenantId}:${reportType}`;
    
    if (!params || Object.keys(params).length === 0) {
      return baseKey;
    }
    
    // Create deterministic hash from parameters
    const paramStr = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    const paramHash = Buffer.from(paramStr).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
    return `${baseKey}:${paramHash}`;
  }

  /**
   * Get cache metrics key
   */
  private static getMetricsKey(tenantId: string, reportType: ReportType): string {
    return `metrics:${tenantId}:${reportType}`;
  }

  /**
   * Get cached report data
   */
  static async get<T>(options: CacheOptions): Promise<T | null> {
    const { tenantId, reportType, params } = options;
    const cacheKey = this.getCacheKey(tenantId, reportType, params);
    
    try {
      const cachedData = await redis.get(cacheKey);
      
      if (cachedData) {
        // Update metrics
        await this.updateMetrics(tenantId, reportType, 'hit');
        
        structuredLogger.debug('[Report Cache] Cache hit', {
          component: 'report-cache-manager',
          tenantId,
          reportType,
          cacheKey
        });
        
        return JSON.parse(cachedData);
      } else {
        // Update metrics
        await this.updateMetrics(tenantId, reportType, 'miss');
        
        structuredLogger.debug('[Report Cache] Cache miss', {
          component: 'report-cache-manager',
          tenantId,
          reportType,
          cacheKey
        });
        
        return null;
      }
    } catch (error) {
      // Update metrics
      await this.updateMetrics(tenantId, reportType, 'error');
      
      structuredLogger.error('[Report Cache] Error retrieving from cache', error, {
        component: 'report-cache-manager',
        tenantId,
        reportType,
        cacheKey
      });
      
      return null;
    }
  }

  /**
   * Set cached report data with TTL
   */
  static async set<T>(data: T, options: CacheOptions): Promise<boolean> {
    const { tenantId, reportType, params } = options;
    const cacheKey = this.getCacheKey(tenantId, reportType, params);
    const ttl = REPORT_TTL[reportType];
    
    try {
      // Add metadata to cached data
      const cacheData = {
        data,
        metadata: {
          tenantId,
          reportType,
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
          ttl,
          params
        }
      };
      
      await redis.setex(cacheKey, ttl, JSON.stringify(cacheData));
      
      // Update metrics
      await this.updateMetrics(tenantId, reportType, 'set');
      
      structuredLogger.debug('[Report Cache] Data cached successfully', {
        component: 'report-cache-manager',
        tenantId,
        reportType,
        cacheKey,
        ttl: `${ttl}s`
      });
      
      return true;
    } catch (error) {
      structuredLogger.error('[Report Cache] Error caching data', error, {
        component: 'report-cache-manager',
        tenantId,
        reportType,
        cacheKey
      });
      
      return false;
    }
  }

  /**
   * Execute function with caching
   */
  static async withCache<T>(
    fetchFunction: () => Promise<T>,
    options: CacheOptions
  ): Promise<T> {
    const { forceRefresh = false } = options;
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await this.get<T>(options);
      if (cached) {
        return cached;
      }
    }
    
    // Fetch fresh data
    const freshData = await fetchFunction();
    
    // Cache the result
    await this.set(freshData, options);
    
    return freshData;
  }

  /**
   * Invalidate specific report cache
   */
  static async invalidate(tenantId: string, reportType: ReportType, params?: Record<string, any>): Promise<boolean> {
    const cacheKey = this.getCacheKey(tenantId, reportType, params);
    
    try {
      await redis.del(cacheKey);
      
      structuredLogger.info('[Report Cache] Cache invalidated', {
        component: 'report-cache-manager',
        tenantId,
        reportType,
        cacheKey
      });
      
      return true;
    } catch (error) {
      structuredLogger.error('[Report Cache] Error invalidating cache', error, {
        component: 'report-cache-manager',
        tenantId,
        reportType,
        cacheKey
      });
      
      return false;
    }
  }

  /**
   * Invalidate all report caches for a tenant
   */
  static async invalidateAllForTenant(tenantId: string): Promise<number> {
    const pattern = `*report:${tenantId}:*`;
    
    try {
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
        
        structuredLogger.info('[Report Cache] All tenant caches invalidated', {
          component: 'report-cache-manager',
          tenantId,
          keysRemoved: keys.length
        });
      }
      
      return keys.length;
    } catch (error) {
      structuredLogger.error('[Report Cache] Error invalidating all tenant caches', error, {
        component: 'report-cache-manager',
        tenantId
      });
      
      return 0;
    }
  }

  /**
   * Background refresh for frequently accessed reports
   */
  static async scheduleBackgroundRefresh<T>(
    fetchFunction: () => Promise<T>,
    options: CacheOptions
  ): Promise<void> {
    const { tenantId, reportType } = options;
    
    try {
      // Check if data exists and when it expires
      const cacheKey = this.getCacheKey(tenantId, reportType, options.params);
      const ttl = await redis.ttl(cacheKey);
      
      // If cache expires in less than 25% of TTL, refresh in background
      const refreshThreshold = REPORT_TTL[reportType] * 0.25;
      
      if (ttl > 0 && ttl < refreshThreshold) {
        structuredLogger.info('[Report Cache] Scheduling background refresh', {
          component: 'report-cache-manager',
          tenantId,
          reportType,
          remainingTtl: ttl,
          refreshThreshold
        });
        
        // Refresh in background (don't await)
        setImmediate(async () => {
          try {
            const freshData = await fetchFunction();
            await this.set(freshData, options);
            
            structuredLogger.debug('[Report Cache] Background refresh completed', {
              component: 'report-cache-manager',
              tenantId,
              reportType
            });
          } catch (error) {
            structuredLogger.error('[Report Cache] Background refresh failed', error, {
              component: 'report-cache-manager',
              tenantId,
              reportType
            });
          }
        });
      }
    } catch (error) {
      structuredLogger.error('[Report Cache] Error scheduling background refresh', error, {
        component: 'report-cache-manager',
        tenantId,
        reportType
      });
    }
  }

  /**
   * Update cache metrics
   */
  private static async updateMetrics(tenantId: string, reportType: ReportType, operation: 'hit' | 'miss' | 'error' | 'set'): Promise<void> {
    const metricsKey = this.getMetricsKey(tenantId, reportType);
    
    try {
      const metrics = await redis.hgetall(metricsKey);
      const current: CacheMetrics = {
        hits: parseInt(metrics.hits || '0'),
        misses: parseInt(metrics.misses || '0'),
        errors: parseInt(metrics.errors || '0'),
        totalRequests: parseInt(metrics.totalRequests || '0'),
        lastRefresh: metrics.lastRefresh || new Date().toISOString()
      };
      
      // Update counters
      if (operation === 'hit') current.hits++;
      else if (operation === 'miss') current.misses++;
      else if (operation === 'error') current.errors++;
      else if (operation === 'set') current.lastRefresh = new Date().toISOString();
      
      if (operation !== 'set') current.totalRequests++;
      
      // Save updated metrics (expire after 24 hours)
      await redis.hset(metricsKey, current);
      await redis.expire(metricsKey, 24 * 60 * 60);
      
    } catch (error) {
      // Don't log metrics errors to avoid spam
    }
  }

  /**
   * Get cache metrics for a tenant and report type
   */
  static async getMetrics(tenantId: string, reportType: ReportType): Promise<CacheMetrics | null> {
    const metricsKey = this.getMetricsKey(tenantId, reportType);
    
    try {
      const metrics = await redis.hgetall(metricsKey);
      
      if (Object.keys(metrics).length === 0) {
        return null;
      }
      
      return {
        hits: parseInt(metrics.hits || '0'),
        misses: parseInt(metrics.misses || '0'),
        errors: parseInt(metrics.errors || '0'),
        totalRequests: parseInt(metrics.totalRequests || '0'),
        lastRefresh: metrics.lastRefresh || ''
      };
    } catch (error) {
      structuredLogger.error('[Report Cache] Error retrieving metrics', error, {
        component: 'report-cache-manager',
        tenantId,
        reportType
      });
      
      return null;
    }
  }

  /**
   * Get overall cache statistics for monitoring
   */
  static async getCacheStats(tenantId: string): Promise<{
    reportTypes: ReportType[];
    totalHits: number;
    totalMisses: number;
    totalErrors: number;
    hitRate: number;
    cacheSize: number;
  }> {
    try {
      const reportTypes = Object.keys(REPORT_TTL) as ReportType[];
      const metricsPromises = reportTypes.map(type => this.getMetrics(tenantId, type));
      const allMetrics = await Promise.all(metricsPromises);
      
      const totalHits = allMetrics.reduce((sum, m) => sum + (m?.hits || 0), 0);
      const totalMisses = allMetrics.reduce((sum, m) => sum + (m?.misses || 0), 0);
      const totalErrors = allMetrics.reduce((sum, m) => sum + (m?.errors || 0), 0);
      const totalRequests = totalHits + totalMisses;
      const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
      
      // Get cache size (approximate)
      const cachePattern = `*report:${tenantId}:*`;
      const cacheKeys = await redis.keys(cachePattern);
      
      return {
        reportTypes,
        totalHits,
        totalMisses,
        totalErrors,
        hitRate: Math.round(hitRate * 100) / 100,
        cacheSize: cacheKeys.length
      };
    } catch (error) {
      structuredLogger.error('[Report Cache] Error retrieving cache stats', error, {
        component: 'report-cache-manager',
        tenantId
      });
      
      return {
        reportTypes: [],
        totalHits: 0,
        totalMisses: 0,
        totalErrors: 0,
        hitRate: 0,
        cacheSize: 0
      };
    }
  }

  /**
   * Warm cache for frequently accessed reports
   */
  static async warmCache<T>(
    reportType: ReportType,
    fetchFunction: () => Promise<T>,
    options: Pick<CacheOptions, 'tenantId' | 'params'>
  ): Promise<boolean> {
    try {
      structuredLogger.info('[Report Cache] Warming cache', {
        component: 'report-cache-manager',
        tenantId: options.tenantId,
        reportType
      });
      
      const data = await fetchFunction();
      const success = await this.set(data, {
        ...options,
        reportType
      });
      
      structuredLogger.info('[Report Cache] Cache warming completed', {
        component: 'report-cache-manager',
        tenantId: options.tenantId,
        reportType,
        success
      });
      
      return success;
    } catch (error) {
      structuredLogger.error('[Report Cache] Cache warming failed', error, {
        component: 'report-cache-manager',
        tenantId: options.tenantId,
        reportType
      });
      
      return false;
    }
  }
}