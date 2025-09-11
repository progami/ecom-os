/**
 * CSRF Token Store Initialization
 * 
 * This module initializes the appropriate token store based on environment.
 * In production, it uses Redis for persistence across instances.
 * In development, it falls back to in-memory storage.
 */

import { createTokenStore, RedisTokenStore } from './csrf-redis-store'
import type { TokenStore } from './csrf'

let tokenStore: TokenStore | null = null

/**
 * Initialize and return the token store singleton
 */
export function getTokenStore(): TokenStore {
  if (!tokenStore) {
    tokenStore = createTokenStore()
    
    // Log the store type being used
    if (tokenStore instanceof RedisTokenStore) {
      console.log('[CSRF] Using Redis token store for production scalability')
    } else {
      console.warn('[CSRF] Using in-memory token store - not suitable for production')
    }
  }
  
  return tokenStore
}

/**
 * Health check for token store
 */
export async function checkTokenStoreHealth(): Promise<{
  healthy: boolean
  type: string
  details?: any
}> {
  const store = getTokenStore()
  
  if (store instanceof RedisTokenStore) {
    const healthy = await store.isHealthy()
    const stats = healthy ? await store.getStats() : null
    
    return {
      healthy,
      type: 'redis',
      details: stats
    }
  }
  
  return {
    healthy: true,
    type: 'memory',
    details: {
      warning: 'In-memory store - not suitable for production'
    }
  }
}

/**
 * Cleanup function for graceful shutdown
 */
export async function cleanupTokenStore(): Promise<void> {
  if (tokenStore) {
    if (tokenStore instanceof RedisTokenStore) {
      await tokenStore.close()
      console.log('[CSRF] Redis connection closed')
    } else if ('destroy' in tokenStore) {
      // @ts-ignore - FallbackMemoryStore has destroy method
      tokenStore.destroy()
      console.log('[CSRF] Memory store cleaned up')
    }
    
    tokenStore = null
  }
}

// Handle process termination
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    await cleanupTokenStore()
  })
  
  process.on('SIGTERM', async () => {
    await cleanupTokenStore()
  })
}