/* eslint-disable no-console */
/**
 * Redis-based CSRF Token Store
 * 
 * Persists CSRF tokens across server instances using Redis.
 * This replaces the in-memory Map implementation for production scalability.
 */

import { Redis } from 'ioredis'

/**
 * Minimal contract for CSRF token stores. Implementations can expose
 * additional helpers (e.g. health checks) as needed, but the core
 * interface keeps read/write operations consistent across Redis and
 * in-memory variants.
 */
export interface TokenStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlMs?: number): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
}

/**
 * Redis implementation of TokenStore interface
 */
export class RedisTokenStore implements TokenStore {
  private redis: Redis
  private prefix: string
  private defaultTTL: number

  constructor(options?: {
    redisUrl?: string
    prefix?: string
    defaultTTL?: number
  }) {
    const redisUrl = options?.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379'
    this.prefix = options?.prefix || 'csrf:'
    this.defaultTTL = options?.defaultTTL || 24 * 60 * 60 * 1000 // 24 hours in ms

    // Initialize Redis client
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          console.error('[CSRF] Redis connection failed after 3 retries')
          return null
        }
        const delay = Math.min(times * 200, 2000)
        return delay
      },
      reconnectOnError(err) {
        const targetError = 'READONLY'
        if (err.message.includes(targetError)) {
          // Only reconnect when the error contains "READONLY"
          return true
        }
        return false
      }
    })

    // Handle Redis events
    this.redis.on('error', (err) => {
      console.error('[CSRF] Redis error:', err.message)
    })

    this.redis.on('connect', () => {
      console.log('[CSRF] Redis connected successfully')
    })

    this.redis.on('ready', () => {
      console.log('[CSRF] Redis ready to accept commands')
    })
  }

  /**
   * Get token from Redis
   */
  async get(key: string): Promise<string | null> {
    try {
      const fullKey = this.prefix + key
      const value = await this.redis.get(fullKey)
      
      if (!value) {
        return null
      }

      // Check if token is expired (if stored with expiry info)
      try {
        const data = JSON.parse(value)
        if (data.expires && data.expires < Date.now()) {
          await this.redis.del(fullKey)
          return null
        }
        return data.token || value
      } catch {
        // If not JSON, return as-is (backward compatibility)
        return value
      }
    } catch (error) {
      console.error('[CSRF] Redis get error:', error)
      return null
    }
  }

  /**
   * Set token in Redis with TTL
   */
  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    try {
      const fullKey = this.prefix + key
      const ttl = ttlMs || this.defaultTTL
      
      // Store as JSON with expiry info for additional validation
      const data = JSON.stringify({
        token: value,
        expires: Date.now() + ttl,
        createdAt: Date.now()
      })

      // Set with TTL in seconds (Redis uses seconds, not milliseconds)
      await this.redis.setex(fullKey, Math.floor(ttl / 1000), data)
    } catch (error) {
      console.error('[CSRF] Redis set error:', error)
      throw new Error('Failed to store CSRF token')
    }
  }

  /**
   * Delete token from Redis
   */
  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.prefix + key
      await this.redis.del(fullKey)
    } catch (error) {
      console.error('[CSRF] Redis delete error:', error)
    }
  }

  /**
   * Clear all CSRF tokens (use with caution!)
   */
  async clear(): Promise<void> {
    try {
      const pattern = this.prefix + '*'
      const keys = await this.redis.keys(pattern)
      
      if (keys.length > 0) {
        await this.redis.del(...keys)
        console.log(`[CSRF] Cleared ${keys.length} tokens`)
      }
    } catch (error) {
      console.error('[CSRF] Redis clear error:', error)
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit()
  }

  /**
   * Health check for Redis connection
   */
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.redis.ping()
      return result === 'PONG'
    } catch {
      return false
    }
  }

  /**
   * Get statistics about stored tokens
   */
  async getStats(): Promise<{
    totalTokens: number
    memoryUsage: number
  }> {
    try {
      const pattern = this.prefix + '*'
      const keys = await this.redis.keys(pattern)
      
      let memoryUsage = 0
      if (keys.length > 0) {
        // Sample memory usage from first 100 keys
        const sampleKeys = keys.slice(0, 100)
        for (const key of sampleKeys) {
          const usage = await this.redis.memory('USAGE', key)
          memoryUsage += usage || 0
        }
        // Estimate total based on sample
        memoryUsage = Math.floor((memoryUsage / sampleKeys.length) * keys.length)
      }

      return {
        totalTokens: keys.length,
        memoryUsage
      }
    } catch (error) {
      console.error('[CSRF] Stats error:', error)
      return {
        totalTokens: 0,
        memoryUsage: 0
      }
    }
  }
}

/**
 * Fallback in-memory store for development
 */
export class FallbackMemoryStore implements TokenStore {
  private store = new Map<string, { token: string; expires: number }>()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Periodic cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)

    console.warn('[CSRF] Using in-memory fallback store. Use Redis in production!')
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    
    if (entry.expires < Date.now()) {
      this.store.delete(key)
      return null
    }
    
    return entry.token
  }

  async set(key: string, value: string, ttlMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    this.store.set(key, {
      token: value,
      expires: Date.now() + ttlMs
    })
    
    // Cleanup if store gets too large
    if (this.store.size > 10000) {
      this.cleanup()
    }
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async clear(): Promise<void> {
    this.store.clear()
  }

  private cleanup(): void {
    const now = Date.now()
    let cleaned = 0
    
    for (const [key, entry] of this.store.entries()) {
      if (entry.expires < now) {
        this.store.delete(key)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      console.log(`[CSRF] Cleaned up ${cleaned} expired tokens`)
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.store.clear()
  }
}

/**
 * Factory function to create appropriate token store
 */
export function createTokenStore(): TokenStore {
  if (process.env.NODE_ENV === 'production' || process.env.USE_REDIS === 'true') {
    try {
      return new RedisTokenStore()
    } catch (error) {
      console.error('[CSRF] Failed to initialize Redis store:', error)
      console.warn('[CSRF] Falling back to in-memory store')
      return new FallbackMemoryStore()
    }
  }
  
  // Use in-memory for development/testing
  return new FallbackMemoryStore()
}
