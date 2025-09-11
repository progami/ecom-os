'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Only register in production
      if (process.env.NODE_ENV === 'production') {
        registerServiceWorker();
      }
    }
  }, []);

  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      console.log('Service Worker registered successfully', {
        scope: registration.scope,
      });

      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // Check every hour

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available
              toast.success('New version available! Refresh to update.', {
                duration: 10000,
                action: {
                  label: 'Refresh',
                  onClick: () => window.location.reload(),
                },
              });
            }
          });
        }
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_COMPLETE') {
          toast.success(event.data.message);
        }
      });

      // Handle offline/online events
      window.addEventListener('online', () => {
        toast.success('Back online! Syncing data...');
        if (registration.sync) {
          registration.sync.register('sync-reports');
        }
      });

      window.addEventListener('offline', () => {
        toast.error('You are offline. Some features may be limited.');
      });

    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  return null;
}