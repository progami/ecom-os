import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const start = Date.now();
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  // Skip logging for static assets
  if (!pathname.includes('_next') && !pathname.includes('favicon')) {
    // Log the request on the server side
    console.log(`[Middleware] ${method} ${pathname}`);
  }

  // Add security headers
  const headers = new Headers(request.headers);
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  const response = NextResponse.next({
    request: {
      headers,
    },
  });

  // Add request timing header
  response.headers.set('X-Response-Time', `${Date.now() - start}ms`);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};