// Auth state refresh script
// This script ensures that the auth state is properly refreshed after OAuth callbacks
(function() {
  'use strict';
  
  // Only run on client side
  if (typeof window === 'undefined') return;
  
  // Check if we're coming from an OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const isOAuthCallback = urlParams.get('connected') === 'true' || 
                         window.location.pathname === '/finance' && document.referrer.includes('/api/v1/xero/auth');
  
  if (isOAuthCallback) {
    console.log('[AuthStateRefresh] OAuth callback detected, forcing auth refresh');
    
    // Wait a bit for cookies to be set
    setTimeout(() => {
      // Dispatch custom event that AuthContext listens to
      window.dispatchEvent(new CustomEvent('forceAuthRefresh'));
      
      // Also try to call the global helper if available
      if (window.forceAuthRefresh) {
        window.forceAuthRefresh();
      }
    }, 500);
  }
  
  // Also refresh when page becomes visible after being hidden
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden && sessionStorage.getItem('oauth_in_progress')) {
      console.log('[AuthStateRefresh] Page visible after OAuth, refreshing auth');
      sessionStorage.removeItem('oauth_in_progress');
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('forceAuthRefresh'));
      }, 500);
    }
  });
  
  // Mark OAuth in progress when clicking Connect to Xero
  document.addEventListener('click', function(e) {
    const target = e.target;
    if (target && target.textContent && target.textContent.includes('Connect to Xero')) {
      console.log('[AuthStateRefresh] Xero connection initiated');
      sessionStorage.setItem('oauth_in_progress', 'true');
    }
  });
})();