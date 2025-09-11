import { NextRequest, NextResponse } from 'next/server';
import { structuredLogger } from '@/lib/logger';
import { AUTH_COOKIE_OPTIONS, SESSION_COOKIE_NAME, TOKEN_COOKIE_NAME } from '@/lib/cookie-config';

export async function POST(request: NextRequest) {
  try {
    structuredLogger.info('User signing out', {
      component: 'auth-signout',
      cookies: request.headers.get('cookie')
    });
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3003';
    
    // Create response
    const response = NextResponse.json({ success: true });
    
    // Clear all auth-related cookies
    response.cookies.delete(SESSION_COOKIE_NAME);
    response.cookies.delete(TOKEN_COOKIE_NAME);
    response.cookies.delete('xero_state');
    response.cookies.delete('xero_pkce');
    response.cookies.delete('xero_token');
    
    // Set cookies to expire immediately with consistent options
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: 0
    });
    
    response.cookies.set(TOKEN_COOKIE_NAME, '', {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: 0
    });
    
    response.cookies.set('xero_token', '', {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: 0
    });
    
    structuredLogger.info('Signout complete - all cookies cleared', {
      component: 'auth-signout'
    });
    
    return response;
  } catch (error) {
    structuredLogger.error('Error signing out', error, {
      component: 'auth-signout'
    });
    
    return NextResponse.json(
      { error: 'Failed to sign out' },
      { status: 500 }
    );
  }
}