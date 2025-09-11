// Clear stale sync data on page load
(function() {
  'use strict';
  
  try {
    // Only run in browser environment
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    // Clear any stale sync-related data
    const keysToCheck = [
      'sync_in_progress',
      'sync_last_attempt',
      'sync_retry_count',
      'sync_error_state'
    ];

    keysToCheck.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          const data = JSON.parse(value);
          // Clear if data is older than 5 minutes
          if (data.timestamp && Date.now() - data.timestamp > 5 * 60 * 1000) {
            localStorage.removeItem(key);
            console.log(`[Clear Stale Sync] Removed stale key: ${key}`);
          }
        } catch (e) {
          // If parsing fails, remove the key
          localStorage.removeItem(key);
          console.log(`[Clear Stale Sync] Removed invalid key: ${key}`);
        }
      }
    });

    // Clear any stuck sync flags
    const syncFlag = localStorage.getItem('xero_sync_in_progress');
    if (syncFlag === 'true') {
      // Check if there's a timestamp
      const syncStartTime = localStorage.getItem('xero_sync_start_time');
      if (syncStartTime) {
        const elapsed = Date.now() - parseInt(syncStartTime, 10);
        // If sync has been running for more than 5 minutes, clear it
        if (elapsed > 5 * 60 * 1000) {
          localStorage.removeItem('xero_sync_in_progress');
          localStorage.removeItem('xero_sync_start_time');
          console.log('[Clear Stale Sync] Cleared stuck sync flag');
        }
      } else {
        // No timestamp, clear the flag
        localStorage.removeItem('xero_sync_in_progress');
        console.log('[Clear Stale Sync] Cleared sync flag without timestamp');
      }
    }
  } catch (error) {
    // Silently fail - this is a cleanup script
    console.error('[Clear Stale Sync] Error during cleanup:', error);
  }
})();