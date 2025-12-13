import { NextRequest, NextResponse } from 'next/server';
import { structuredLogger } from '@/lib/logger';

/**
 * Middleware to log API requests and responses for better debugging
 * This helps track API usage patterns and debug issues
 */

interface RequestLogContext {
  method: string;
  url: string;
  pathname: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  timestamp: string;
  requestId: string;
}

interface ResponseLogContext extends RequestLogContext {
  status: number;
  duration: number;
  error?: string;
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract headers for logging (excluding sensitive ones)
 */
function extractHeaders(headers: Headers): Record<string, string> {
  const safeHeaders: Record<string, string> = {};
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-access-token'];
  
  headers.forEach((value, key) => {
    if (!sensitiveHeaders.includes(key.toLowerCase())) {
      safeHeaders[key] = value;
    } else {
      safeHeaders[key] = '[REDACTED]';
    }
  });
  
  return safeHeaders;
}

/**
 * Log API request details
 */
export function logApiRequest(request: NextRequest): RequestLogContext {
  const url = new URL(request.url);
  const query: Record<string, string> = {};
  
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  
  const context: RequestLogContext = {
    method: request.method,
    url: request.url,
    pathname: url.pathname,
    headers: extractHeaders(request.headers),
    query,
    timestamp: new Date().toISOString(),
    requestId: generateRequestId()
  };
  
  structuredLogger.info(`[API Request] ${request.method} ${url.pathname}`, {
    ...context,
    userAgent: request.headers.get('user-agent'),
    referer: request.headers.get('referer'),
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
  });
  
  return context;
}

/**
 * Log API response details
 */
export function logApiResponse(
  context: RequestLogContext,
  response: NextResponse,
  startTime: number,
  error?: Error
): void {
  const duration = Date.now() - startTime;
  
  const responseContext: ResponseLogContext = {
    ...context,
    status: response.status,
    duration,
    error: error?.message
  };
  
  // Choose log level based on status code
  const logLevel = response.status >= 500 ? 'error' : 
                   response.status >= 400 ? 'warn' : 
                   'info';
  
  const message = `[API Response] ${context.method} ${context.pathname} -> ${response.status} (${duration}ms)`;
  
  if (logLevel === 'error') {
    structuredLogger.error(message, error, responseContext);
  } else if (logLevel === 'warn') {
    structuredLogger.warn(message, responseContext);
  } else {
    structuredLogger.info(message, responseContext);
  }
  
  // Log slow requests
  if (duration > 3000) {
    structuredLogger.warn('[API Performance] Slow request detected', {
      ...responseContext,
      threshold: 3000
    });
  }
}

/**
 * Wrap an API handler with request/response logging
 */
export function withRequestLogging<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    const request = args[0] as NextRequest;
    const startTime = Date.now();
    const context = logApiRequest(request);
    
    try {
      const response = await handler(...args);
      logApiResponse(context, response, startTime);
      
      // Add request ID to response headers for tracing
      response.headers.set('X-Request-Id', context.requestId);
      
      return response;
    } catch (error) {
      const errorResponse = NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
      
      logApiResponse(context, errorResponse, startTime, error as Error);
      errorResponse.headers.set('X-Request-Id', context.requestId);
      
      throw error;
    }
  }) as T;
}