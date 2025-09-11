import { structuredLogger } from './logger';
import { xeroConfig } from './xero-client';
import { XeroClient } from 'xero-node';

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000,   // 10 seconds
  backoffFactor: 2
};

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(
  attempt: number, 
  initialDelay: number, 
  maxDelay: number, 
  backoffFactor: number
): number {
  const delay = initialDelay * Math.pow(backoffFactor, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Refresh Xero token with exponential backoff retry logic
 */
export async function refreshTokenWithRetry(
  xeroClient: XeroClient,
  refreshToken: string,
  options?: RetryOptions
): Promise<any> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;
  
  structuredLogger.info('[Token Refresh] Starting token refresh with retry', {
    component: 'xero-token-refresh',
    maxRetries: config.maxRetries
  });
  
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      structuredLogger.debug(`[Token Refresh] Attempt ${attempt}/${config.maxRetries}`, {
        component: 'xero-token-refresh'
      });
      
      // Attempt to refresh the token
      const newTokenSet = await xeroClient.refreshWithRefreshToken(
        xeroConfig.clientId,
        xeroConfig.clientSecret,
        refreshToken
      );
      
      structuredLogger.info('[Token Refresh] Token refreshed successfully', {
        component: 'xero-token-refresh',
        attempt,
        expiresAt: newTokenSet.expires_at
      });
      
      // Write success to development log
      try {
        const fs = require('fs');
        fs.appendFileSync('development.log', 
          `\n=== XERO TOKEN REFRESH SUCCESS ${new Date().toISOString()} ===\n` +
          `Attempt: ${attempt}/${config.maxRetries}\n` +
          `New Expiry: ${new Date((newTokenSet.expires_at || 0) * 1000).toISOString()}\n` +
          `=== END TOKEN REFRESH SUCCESS ===\n`
        );
      } catch (logError) {
        // Silent fail
      }
      
      return newTokenSet;
      
    } catch (error: any) {
      lastError = error;
      
      const errorDetails = {
        component: 'xero-token-refresh',
        attempt,
        errorType: error?.constructor?.name || 'Unknown',
        errorMessage: error?.message || 'No error message',
        errorCode: error?.statusCode || error?.response?.statusCode,
        isNetworkError: error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT',
        isInvalidGrant: error?.message?.includes('invalid_grant') || 
                       error?.response?.body?.error === 'invalid_grant'
      };
      
      structuredLogger.error(`[Token Refresh] Attempt ${attempt} failed`, error, errorDetails);
      
      // Write failure to development log
      try {
        const fs = require('fs');
        fs.appendFileSync('development.log', 
          `\n=== XERO TOKEN REFRESH ATTEMPT FAILED ${new Date().toISOString()} ===\n` +
          `Attempt: ${attempt}/${config.maxRetries}\n` +
          `Error: ${errorDetails.errorMessage}\n` +
          `Code: ${errorDetails.errorCode || 'N/A'}\n` +
          `Is Network Error: ${errorDetails.isNetworkError}\n` +
          `Is Invalid Grant: ${errorDetails.isInvalidGrant}\n` +
          `=== END ATTEMPT FAILURE ===\n`
        );
      } catch (logError) {
        // Silent fail
      }
      
      // Don't retry if it's an invalid grant error (refresh token is invalid)
      if (errorDetails.isInvalidGrant) {
        structuredLogger.warn('[Token Refresh] Invalid grant error - refresh token is expired or revoked', {
          component: 'xero-token-refresh'
        });
        throw error;
      }
      
      // Don't retry on the last attempt
      if (attempt === config.maxRetries) {
        structuredLogger.error('[Token Refresh] All retry attempts exhausted', undefined, {
          component: 'xero-token-refresh',
          totalAttempts: config.maxRetries
        });
        throw error;
      }
      
      // Calculate backoff delay
      const delay = calculateBackoffDelay(
        attempt,
        config.initialDelay,
        config.maxDelay,
        config.backoffFactor
      );
      
      structuredLogger.info(`[Token Refresh] Retrying after ${delay}ms`, {
        component: 'xero-token-refresh',
        nextAttempt: attempt + 1,
        delayMs: delay
      });
      
      // Wait before retrying
      await sleep(delay);
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Token refresh failed after all retries');
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  // Network errors
  if (error?.code === 'ECONNREFUSED' || 
      error?.code === 'ETIMEDOUT' || 
      error?.code === 'ENOTFOUND' ||
      error?.code === 'ECONNRESET') {
    return true;
  }
  
  // HTTP status codes that might be temporary
  const statusCode = error?.statusCode || error?.response?.statusCode;
  if (statusCode === 429 || // Too Many Requests
      statusCode === 502 || // Bad Gateway
      statusCode === 503 || // Service Unavailable
      statusCode === 504) { // Gateway Timeout
    return true;
  }
  
  // Xero-specific temporary errors
  if (error?.message?.includes('temporarily unavailable') ||
      error?.message?.includes('rate limit')) {
    return true;
  }
  
  return false;
}