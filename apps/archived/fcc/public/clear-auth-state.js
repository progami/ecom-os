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
    
    // Check for session cookie
    const cookies = document.cookie.split(';');
    const sessionCookie = cookies.find(c => c.trim().startsWith('user_session='));
    
    if (sessionCookie) {
      try {
        const sessionValue = decodeURIComponent(sessionCookie.split('=')[1]);
        const sessionData = JSON.parse(sessionValue);
        const hasValidSession = (sessionData.user && sessionData.user.id) || 
                               (sessionData.userId && sessionData.email);
        
        // Set a flag that React can check
        if (hasValidSession) {
          window.__AUTH_STATE_OPTIMISTIC__ = true;
          console.log('[Clear Auth State] Found valid session, setting optimistic auth state');
        }
      } catch (e) {
        console.error('[Clear Auth State] Error parsing session cookie:', e);
      }
    } else {
      window.__AUTH_STATE_OPTIMISTIC__ = false;
      console.log('[Clear Auth State] No session cookie found');
    }
  } catch (error) {
    console.error('[Clear Auth State] Error in auth state handler:', error);
  }
})();