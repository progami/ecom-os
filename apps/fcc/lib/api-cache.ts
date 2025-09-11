import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

interface CacheOptions {
  maxAge?: number; // in seconds
  sMaxAge?: number; // shared max age for CDN
  staleWhileRevalidate?: number; // in seconds
  private?: boolean;
  mustRevalidate?: boolean;
  immutable?: boolean;
}

interface CacheEntry {
  data: any;
  etag: string;
  timestamp: number;
  expires: number;
}

// In-memory cache for development
const memoryCache = new Map<string, CacheEntry>();

export class APICache {
  private static instance: APICache;
  
  private constructor() {}
  
  static getInstance(): APICache {
    if (!APICache.instance) {
      APICache.instance = new APICache();
    }
    return APICache.instance;
  }

  // Generate ETag from data
  generateETag(data: any): string {
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify(data));
    return `"${hash.digest('hex')}"`;
  }

  // Build cache control header
  buildCacheControlHeader(options: CacheOptions): string {
    const directives: string[] = [];
    
    if (options.private) {
      directives.push('private');
    } else {
      directives.push('public');
    }
    
    if (options.maxAge !== undefined) {
      directives.push(`max-age=${options.maxAge}`);
    }
    
    if (options.sMaxAge !== undefined) {
      directives.push(`s-maxage=${options.sMaxAge}`);
    }
    
    if (options.staleWhileRevalidate !== undefined) {
      directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
    }
    
    if (options.mustRevalidate) {
      directives.push('must-revalidate');
    }
    
    if (options.immutable) {
      directives.push('immutable');
    }
    
    return directives.join(', ');
  }

  // Check if request has valid cache
  async checkCache(request: NextRequest, key: string): Promise<CacheEntry | null> {
    const ifNoneMatch = request.headers.get('If-None-Match');
    const cachedEntry = memoryCache.get(key);
    
    if (!cachedEntry) {
      return null;
    }
    
    // Check if cache is expired
    if (Date.now() > cachedEntry.expires) {
      memoryCache.delete(key);
      return null;
    }
    
    // Check ETag match
    if (ifNoneMatch && ifNoneMatch === cachedEntry.etag) {
      return cachedEntry;
    }
    
    return cachedEntry;
  }

  // Store in cache
  async setCache(key: string, data: any, maxAge: number = 300): Promise<CacheEntry> {
    const etag = this.generateETag(data);
    const entry: CacheEntry = {
      data,
      etag,
      timestamp: Date.now(),
      expires: Date.now() + (maxAge * 1000),
    };
    
    memoryCache.set(key, entry);
    
    // Clean up old entries periodically
    if (memoryCache.size > 1000) {
      this.cleanupCache();
    }
    
    return entry;
  }

  // Clean up expired cache entries
  private cleanupCache() {
    const now = Date.now();
    for (const [key, entry] of memoryCache.entries()) {
      if (now > entry.expires) {
        memoryCache.delete(key);
      }
    }
  }

  // Create cached response
  createCachedResponse(
    data: any,
    etag: string,
    options: CacheOptions = {}
  ): NextResponse {
    const response = NextResponse.json(data);
    
    // Set cache headers
    response.headers.set('Cache-Control', this.buildCacheControlHeader(options));
    response.headers.set('ETag', etag);
    response.headers.set('Last-Modified', new Date().toUTCString());
    
    // Add performance headers
    response.headers.set('X-Response-Time', `${Date.now()}ms`);
    response.headers.set('X-Cache', 'HIT');
    
    return response;
  }

  // Create 304 Not Modified response
  create304Response(etag: string): NextResponse {
    const response = new NextResponse(null, { status: 304 });
    response.headers.set('ETag', etag);
    response.headers.set('X-Cache', 'HIT');
    return response;
  }
}

// Middleware for API caching
export async function withCache(
  request: NextRequest,
  handler: () => Promise<any>,
  options: {
    key: string;
    cacheOptions?: CacheOptions;
    revalidate?: boolean;
  }
): Promise<NextResponse> {
  const cache = APICache.getInstance();
  const { key, cacheOptions = {}, revalidate = false } = options;
  
  // Default cache options for reports
  const defaultOptions: CacheOptions = {
    maxAge: 300, // 5 minutes
    sMaxAge: 600, // 10 minutes for CDN
    staleWhileRevalidate: 3600, // 1 hour
    ...cacheOptions,
  };
  
  try {
    // Check if we should force revalidation
    if (!revalidate) {
      const cachedEntry = await cache.checkCache(request, key);
      
      if (cachedEntry) {
        const ifNoneMatch = request.headers.get('If-None-Match');
        
        // Return 304 if ETag matches
        if (ifNoneMatch === cachedEntry.etag) {
          logger.info(`Cache hit (304) for ${key}`);
          return cache.create304Response(cachedEntry.etag);
        }
        
        // Return cached data
        logger.info(`Cache hit for ${key}`);
        return cache.createCachedResponse(
          cachedEntry.data,
          cachedEntry.etag,
          defaultOptions
        );
      }
    }
    
    // Execute handler and cache result
    logger.info(`Cache miss for ${key}, fetching fresh data`);
    const startTime = Date.now();
    const data = await handler();
    const duration = Date.now() - startTime;
    
    // Store in cache
    const cacheEntry = await cache.setCache(key, data, defaultOptions.maxAge);
    
    // Create response with cache headers
    const response = cache.createCachedResponse(
      data,
      cacheEntry.etag,
      defaultOptions
    );
    
    // Add performance metrics
    response.headers.set('X-Response-Time', `${duration}ms`);
    response.headers.set('X-Cache', revalidate ? 'REVALIDATED' : 'MISS');
    
    return response;
  } catch (error) {
    logger.error(`Error in cached API handler for ${key}:`, error);
    throw error;
  }
}

// Cache key generators for different report types
export const cacheKeys = {
  profitLoss: (filters: Record<string, any>) => 
    `profit-loss:${JSON.stringify(filters)}`,
  
  balanceSheet: (filters: Record<string, any>) => 
    `balance-sheet:${JSON.stringify(filters)}`,
  
  cashFlow: (filters: Record<string, any>) => 
    `cash-flow:${JSON.stringify(filters)}`,
  
  agedReceivables: (filters: Record<string, any>) => 
    `aged-receivables:${JSON.stringify(filters)}`,
  
  agedPayables: (filters: Record<string, any>) => 
    `aged-payables:${JSON.stringify(filters)}`,
  
  bankSummary: (filters: Record<string, any>) => 
    `bank-summary:${JSON.stringify(filters)}`,
};