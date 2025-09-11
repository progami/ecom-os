// Service Worker for performance optimization
const CACHE_NAME = 'bookkeeping-v1';
const STATIC_CACHE_NAME = 'bookkeeping-static-v1';
const API_CACHE_NAME = 'bookkeeping-api-v1';

// URLs to cache for offline access
const STATIC_URLS = [
  '/',
  '/reports',
  '/reports/detailed-reports',
  '/offline.html', // Create an offline fallback page
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/api\/v1\/xero\/reports\/.*/,
  /\/api\/v1\/bookkeeping\/financial-summary/,
  /\/api\/v1\/bookkeeping\/stats/,
];

// Cache duration settings (in seconds)
const CACHE_DURATIONS = {
  static: 60 * 60 * 24 * 7, // 7 days
  api: 60 * 5, // 5 minutes
  images: 60 * 60 * 24 * 30, // 30 days
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching static assets');
      return cache.addAll(STATIC_URLS);
    })
  );
  
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== STATIC_CACHE_NAME && 
              cacheName !== API_CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Handle API requests with network-first strategy
  if (API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(networkFirstStrategy(request, API_CACHE_NAME, CACHE_DURATIONS.api));
    return;
  }
  
  // Handle static assets with cache-first strategy
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE_NAME, CACHE_DURATIONS.static));
    return;
  }
  
  // Handle navigation requests with network-first strategy
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirstStrategy(request, STATIC_CACHE_NAME, CACHE_DURATIONS.static)
        .catch(() => caches.match('/offline.html'))
    );
    return;
  }
  
  // Default to network-first strategy
  event.respondWith(networkFirstStrategy(request, CACHE_NAME, CACHE_DURATIONS.static));
});

// Cache-first strategy - serve from cache, fallback to network
async function cacheFirstStrategy(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Check if cache is still fresh
    const dateHeader = cachedResponse.headers.get('date');
    if (dateHeader) {
      const cachedDate = new Date(dateHeader);
      const now = new Date();
      const age = (now - cachedDate) / 1000;
      
      if (age < maxAge) {
        return cachedResponse;
      }
    }
    
    // Cache is stale, fetch fresh copy in background
    fetchAndCache(request, cache);
    return cachedResponse;
  }
  
  // No cache, fetch from network
  return fetchAndCache(request, cache);
}

// Network-first strategy - try network, fallback to cache
async function networkFirstStrategy(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  
  try {
    const networkResponse = await fetch(request);
    
    // Only cache successful responses
    if (networkResponse.ok) {
      // Clone the response before caching
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Both network and cache failed
    throw error;
  }
}

// Fetch and cache helper
async function fetchAndCache(request, cache) {
  const networkResponse = await fetch(request);
  
  // Only cache successful responses
  if (networkResponse.ok) {
    cache.put(request, networkResponse.clone());
  }
  
  return networkResponse;
}

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync:', event.tag);
  
  if (event.tag === 'sync-reports') {
    event.waitUntil(syncReports());
  }
});

// Sync reports when back online
async function syncReports() {
  try {
    // Clear API cache to force fresh data
    await caches.delete(API_CACHE_NAME);
    
    // Notify all clients to refresh
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        message: 'Reports synchronized successfully'
      });
    });
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
  }
}

// Handle push notifications for important updates
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('Bookkeeping Update', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});