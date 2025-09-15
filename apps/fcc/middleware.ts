import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Content Security Policy
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "font-src 'self'",
  "connect-src 'self' https://api.xero.com https://identity.xero.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

// Configuration
const MAX_REQUEST_SIZE = 1 * 1024 * 1024; // 1MB default
const REQUEST_TIMEOUT = 30000; // 30 seconds default
const SYNC_REQUEST_TIMEOUT = 300000; // 5 minutes for sync operations

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/api/v1/xero/auth',
  '/api/v1/xero/auth/callback',
  '/api/auth/', // NextAuth internal routes
  '/api/health',
  '/_next',
  '/favicon.ico',
  '/public',
]

// Routes that are protected and require authentication
const PROTECTED_ROUTES = [
  '/',
  '/finance',
  '/bookkeeping',
  '/analytics',
  '/cashflow',
  '/database',
  '/setup',
  '/reports'
]

import { cookieDomain } from '@/lib/cookie-config';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware entirely for Next.js static files to preserve proper MIME types
  if (pathname.startsWith('/_next/static/') || 
      pathname.startsWith('/_next/image/') || 
      pathname.endsWith('.js') || 
      pathname.endsWith('.css') || 
      pathname.endsWith('.map')) {
    return NextResponse.next();
  }
  
  // Helper function to check if a user ID is a test user
  const isTestUser = (userId: string) => {
    return userId && (
      userId.startsWith('test-') || 
      userId === 'user-1' || // Original dev bypass user
      userId.includes('test')
    );
  };
  
  // Check if this is a Playwright test
  const userAgent = request.headers.get('user-agent') || '';
  const isPlaywrightTest = userAgent.includes('Playwright');
  
  // Check if this is a Playwright test - only allow for automated tests
  let devBypassSession: any = null;
  
  // Only allow bypass for Playwright tests
  if (isPlaywrightTest && process.env.NODE_ENV === 'test') {
    devBypassSession = {
      user: {
        id: 'test-user-1',
        email: 'test@example.com',
        name: 'Test User'
      },
      userId: 'test-user-1',
      email: 'test@example.com',
      tenantId: 'test-tenant',
      tenantName: 'Test Tenant'
    };
    
    console.log(`[Middleware] Playwright test detected for ${pathname}`);
  }
  
  // Only log in development and skip static assets
  if (process.env.NODE_ENV === 'development' && !pathname.includes('/_next/') && !pathname.includes('.js') && !pathname.includes('.css')) {
    console.log(`[Middleware] Processing request: ${request.method} ${pathname}`);
  }
  
  // Clone the request headers
  const requestHeaders = new Headers(request.headers);
  
  // Check if this is a public route or an API route (API routes handle their own auth)
  const isPublicRoute = PUBLIC_ROUTES.some(route => {
    if (route.startsWith('/_next') || route.startsWith('/api/')) {
      return pathname.startsWith(route);
    }
    return pathname === route;
  }) || pathname.startsWith('/api/');
  
  // If it's not a public route, it requires authentication
  if (!isPublicRoute) {
    // Only log in development and avoid excessive logging
    if (process.env.NODE_ENV === 'development' && !pathname.includes('.')) {
      console.log(`[Middleware] Route ${pathname} requires authentication (isPublicRoute: ${isPublicRoute})`);
    }
    
    // NextAuth session check via JWT cookie
    let hasSession = false;
    try {
      const candidateNames = [
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.session-token'
          : 'next-auth.session-token',
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.session-token'
          : 'ecomos.next-auth.session-token',
        // Legacy app-specific cookie during migration
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.session-token'
          : 'fcc.next-auth.session-token',
      ];
      for (const name of candidateNames) {
        const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET, cookieName: name });
        if (token) { hasSession = true; break; }
      }
    } catch {}

    if (!hasSession && !devBypassSession) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        );
      }
      const central = process.env.CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com'
      const login = new URL('/login', central)
      login.searchParams.set('callbackUrl', request.nextUrl.toString())
      return NextResponse.redirect(login);
    }
    // If dev bypass is present in tests, surface it for downstream diagnostic use
    if (devBypassSession) {
      requestHeaders.set('x-auth-session', JSON.stringify(devBypassSession));
    }
  }
  
  // Add a custom header to track if this is an API route
  if (request.nextUrl.pathname.startsWith('/api/')) {
    requestHeaders.set('x-api-route', 'true');
  }
  
  // Check request size for POST/PUT/PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentLength = request.headers.get('content-length');
    
    if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { error: 'Request body too large', maxSize: MAX_REQUEST_SIZE },
        { status: 413 }
      );
    }
  }
  
  // Set request timeout based on endpoint
  const isSync = request.nextUrl.pathname.includes('/sync');
  const timeout = isSync ? SYNC_REQUEST_TIMEOUT : REQUEST_TIMEOUT;
  requestHeaders.set('x-request-timeout', timeout.toString());
  
  // Create response with modified headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  
  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Add HSTS header for production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }
  
  // Add CSP header (relaxed for development and test)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Content-Security-Policy', CSP_DIRECTIVES);
  } else if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    // More permissive CSP for development/testing
    response.headers.set('Content-Security-Policy', 
      "default-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https: blob:; " +
      "font-src 'self'; " +
      "connect-src 'self' https://api.xero.com https://identity.xero.com ws: wss:; " +
      "frame-ancestors 'none'"
    );
  }
  
  // Request ID for tracking
  const requestId = crypto.randomUUID();
  requestHeaders.set('x-request-id', requestId);
  response.headers.set('x-request-id', requestId);
  
  // Set test session cookie only for Playwright tests
  if (devBypassSession && !request.cookies.get('user_session') && isPlaywrightTest) {
    response.cookies.set('user_session', JSON.stringify(devBypassSession), {
      httpOnly: true,
      secure: false, // Tests run on HTTP
      sameSite: 'lax',
      maxAge: 30 * 60, // 30 minutes for tests
      path: '/',
      domain: cookieDomain
    });
    console.log(`[Middleware] Set test session cookie for Playwright`);
  }
  
  // For API routes, ensure cookies are properly forwarded
  if (request.nextUrl.pathname.startsWith('/api/v1/xero/')) {
    // Log cookie debugging info for Xero routes
    const cookies = request.cookies.getAll();
    // Only log problematic requests (edge runtime compatible)
    if (process.env.NODE_ENV === 'development' && !cookies.some(c => c.name === 'xero_token')) {
      console.log(`⚠️  No Xero token for ${request.method} ${request.nextUrl.pathname}`);
    }
  }
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static JavaScript and CSS files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:js|css|map)).*)',
  ],
};
