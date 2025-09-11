import { NextRequest } from 'next/server';
import { apiLogger, perfLogger } from './index';

// Wrapper function for API routes to ensure logging
export function withApiLogging<T extends (...args: unknown[]) => unknown>(
  handler: T,
  routeName?: string
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    
    // Try to extract request information
    let method = 'UNKNOWN';
    let path = routeName || 'unknown';
    let body = null;
    
    // Check if first argument is NextRequest
    if (args[0] instanceof NextRequest) {
      const request = args[0] as NextRequest;
      method = request.method;
      path = request.nextUrl.pathname;
      
      try {
        const clonedRequest = request.clone();
        body = await clonedRequest.json().catch(() => null);
      } catch (_e) {
        // Ignore body parsing errors
      }
    }
    // Check if it's a traditional req object
    else if (args[0]?.method) {
      const req = args[0] as { method: string; url?: string; body?: unknown };
      method = req.method;
      path = req.url || path;
      body = req.body;
    }
    
    // Log API request
    apiLogger.info(`API Request: ${method} ${path}`, {
      requestId,
      method,
      path,
      body,
      timestamp: new Date().toISOString(),
    });
    
    try {
      // Call the actual handler
      const result = await handler(...args);
      
      const duration = Date.now() - startTime;
      
      // Log successful response
      apiLogger.info(`API Response: ${method} ${path}`, {
        requestId,
        method,
        path,
        duration,
        status: result?.status || 200,
        timestamp: new Date().toISOString(),
      });
      
      // Log slow requests
      perfLogger.slow(`API: ${method} ${path}`, duration, 1000, {
        requestId,
        method,
        path,
      });
      
      return result;
    } catch (_error) {
      const duration = Date.now() - startTime;
      
      // Log error
      apiLogger.error(`API Error: ${method} ${path}`, {
        requestId,
        method,
        path,
        duration,
        error: _error instanceof Error ? {
          message: _error.message,
          stack: _error.stack,
          name: _error.name,
        } : String(_error),
        timestamp: new Date().toISOString(),
      });
      
      // Re-throw the error
      throw _error;
    }
  }) as T;
}

// Simple console log wrapper for debugging
export function logApiCall(_context: string, _data?: unknown) {
  const _timestamp = new Date().toISOString();
  // Log: `[${timestamp}] [API] [${context}]`, data ? JSON.stringify(data, null, 2) : '';
}