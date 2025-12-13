/**
 * Client-side helper for forcing auth status refresh
 * This is used to ensure auth state is properly updated after OAuth callbacks
 */

export function forceAuthRefresh() {
  // Dispatch custom event that AuthContext will listen to
  if (typeof window !== 'undefined') {
    console.log('[AuthRefresh] Dispatching auth refresh event')
    window.dispatchEvent(new CustomEvent('forceAuthRefresh'))
  }
}

// Add global helper for debugging
if (typeof window !== 'undefined') {
  (window as any).forceAuthRefresh = forceAuthRefresh
}