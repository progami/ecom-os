// This script runs before React hydration to help with auth state
(function() {
  'use strict';
  
  try {
    // Clear any stale auth state from sessionStorage
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('auth') || key.includes('sync'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    
    // Central auth cookies are httpOnly, so default to no optimistic session on the client
    window.__AUTH_STATE_OPTIMISTIC__ = false;
    console.log('[Clear Auth State] Defaulting to non-optimistic auth state; relying on server check');
  } catch (error) {
    console.error('[Clear Auth State] Error in auth state handler:', error);
  }
})();
