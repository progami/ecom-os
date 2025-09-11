/**
 * Utility to check if the server is ready to accept requests
 */

// Cache the server ready state to avoid repeated checks
let serverReadyPromise: Promise<boolean> | null = null;
let isServerReady = false;

export async function waitForServerReady(maxRetries = 20, retryDelay = 500) {
  if (typeof window === 'undefined') return true; // Server-side always ready
  
  // If we've already confirmed the server is ready, return immediately
  if (isServerReady) {
    return true;
  }
  
  // If we're already checking, return the existing promise
  if (serverReadyPromise) {
    return serverReadyPromise;
  }
  
  // Start a new check
  serverReadyPromise = checkServerReady(maxRetries, retryDelay);
  const result = await serverReadyPromise;
  
  if (result) {
    isServerReady = true;
  }
  
  return result;
}

async function checkServerReady(maxRetries: number, retryDelay: number): Promise<boolean> {
  let retries = 0;
  
  // First, do a quick check with a reasonable timeout
  try {
    const quickResponse = await fetch('/api/health', {
      method: 'HEAD', // Use HEAD for faster response
      signal: AbortSignal.timeout(2000) // 2s for quick check (increased from 500ms)
    });
    
    if (quickResponse.ok) {
      console.log('[ServerReady] Server is ready (quick check)');
      return true;
    }
  } catch (error) {
    // Quick check failed, proceed with retries
    // Don't log this as an error since it's expected during startup
  }
  
  while (retries < maxRetries) {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      
      if (response.ok) {
        console.log('[ServerReady] Server is ready after', retries, 'retries');
        return true;
      }
    } catch (error) {
      // Server not ready yet
      if (retries % 5 === 0) { // Only log every 5th retry to reduce noise
        console.log('[ServerReady] Server not ready, retrying...', retries + 1, '/', maxRetries);
      }
    }
    
    retries++;
    if (retries < maxRetries) {
      // Use exponential backoff up to a max delay
      const delay = Math.min(retryDelay * Math.pow(1.5, Math.floor(retries / 5)), 2000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.error('[ServerReady] Server failed to become ready after', maxRetries, 'retries');
  return false;
}