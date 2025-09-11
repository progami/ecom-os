import { NextRequest, NextResponse } from 'next/server';
import { apiLogger, perfLogger } from './index';
import crypto from 'crypto';

interface LogContext {
  requestId: string;
  method: string;
  path: string;
  query: Record<string, unknown>;
  headers: Record<string, string>;
  body: unknown;
  userId?: string;
  startTime: number;
}

// Sanitize headers to remove sensitive information
function sanitizeHeaders(headers: Headers): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
  
  headers.forEach((value, key) => {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  });
  
  return sanitized;
}

// Extract request body safely
async function extractBody(request: Request | NextRequest): Promise<unknown> {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const text = await request.text();
      return text ? JSON.parse(text) : null;
    } else if (contentType.includes('multipart/form-data')) {
      return '[FILE_UPLOAD]';
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      return Object.fromEntries(new URLSearchParams(text));
    }
    
    return null;
  } catch (_error) {
    return { error: 'Failed to parse body' };
  }
}

// API logging middleware
export async function apiLoggingMiddleware(
  request: NextRequest,
  handler: (req: NextRequest, context?: unknown) => Promise<Response>
): Promise<Response> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  // Clone the request to read the body
  const clonedRequest = request.clone();
  
  // Extract request details
  const logContext: LogContext = {
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
    query: Object.fromEntries(request.nextUrl.searchParams),
    headers: sanitizeHeaders(request.headers),
    body: await extractBody(clonedRequest),
    startTime,
  };
  
  // Log incoming request
  apiLogger.http('Incoming request', {
    requestId: logContext.requestId,
    method: logContext.method,
    path: logContext.path,
    query: logContext.query,
    headers: logContext.headers,
    body: logContext.body,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent'),
  });
  
  try {
    // Execute the handler
    const response = await handler(request);
    
    // Calculate response time
    const duration = Date.now() - startTime;
    
    // Log response
    apiLogger.http('Request completed', {
      requestId: logContext.requestId,
      method: logContext.method,
      path: logContext.path,
      statusCode: response.status,
      duration,
      contentType: response.headers.get('content-type'),
    });
    
    // Log slow requests
    perfLogger.slow('API Request', duration, 1000, {
      method: logContext.method,
      path: logContext.path,
      statusCode: response.status,
    });
    
    // Add request ID to response headers
    const modifiedResponse = response.clone();
    modifiedResponse.headers.set('x-request-id', requestId);
    
    return modifiedResponse as Response;
  } catch (_error) {
    const duration = Date.now() - startTime;
    
    // Log error
    apiLogger.error('Request failed', {
      requestId: logContext.requestId,
      method: logContext.method,
      path: logContext.path,
      duration,
      error: _error instanceof Error ? {
        message: _error.message,
        stack: _error.stack,
        name: _error.name,
      } : String(_error),
    });
    
    // Return error response
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: _error instanceof Error ? _error.message : 'An unexpected error occurred',
        requestId,
      },
      {
        status: 500,
        headers: {
          'x-request-id': requestId,
        },
      }
    );
  }
}

// Wrapper for API route handlers
export function withLogging<T extends (...args: unknown[]) => Promise<Response>>(
  handler: T,
  _options?: { category?: string }
): T {
  return (async (...args: Parameters<T>) => {
    const [request] = args;
    if (request instanceof NextRequest) {
      return apiLoggingMiddleware(request, () => handler(...args));
    }
    return handler(...args);
  }) as T;
}

// Express-style middleware types for Next.js API routes (pages router compatibility)
interface ExpressRequest {
  method: string
  url: string
  query: Record<string, unknown>
  headers: Record<string, string | string[]>
  body: unknown
  connection?: {
    remoteAddress?: string
  }
}

interface ExpressResponse {
  statusCode: number
  send: (data: unknown) => void
  setHeader: (name: string, value: string) => void
  on: (event: string, callback: (error: Error) => void) => void
}

type NextFunction = () => void

// Express-style middleware for Next.js API routes (pages router compatibility)
export function createLoggingMiddleware() {
  return async (req: ExpressRequest, res: ExpressResponse, next?: NextFunction) => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    
    // Log request
    apiLogger.http('API Request', {
      requestId,
      method: req.method,
      url: req.url,
      query: req.query,
      headers: req.headers,
      body: req.body,
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
    
    // Capture response
    const originalSend = res.send;
    res.send = function (data: unknown) {
      const duration = Date.now() - startTime;
      
      // Log response
      apiLogger.http('API Response', {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
      });
      
      // Log slow requests
      perfLogger.slow('API Request', duration, 1000, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
      });
      
      // Add request ID to response headers
      res.setHeader('x-request-id', requestId);
      
      originalSend.call(this, data);
    };
    
    // Handle errors
    res.on('error', (error: Error) => {
      const duration = Date.now() - startTime;
      
      apiLogger.error('API Error', {
        requestId,
        method: req.method,
        url: req.url,
        duration,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      });
    });
    
    if (next) {
      next();
    }
  };
}