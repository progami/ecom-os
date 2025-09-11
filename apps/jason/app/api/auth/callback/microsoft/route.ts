import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  logger.info('[MicrosoftCallback] OAuth callback received');

  if (error) {
    logger.error('[MicrosoftCallback] OAuth error', { error, description: searchParams.get('error_description') });
    return NextResponse.redirect(new URL('/calendar-aggregator?error=auth_failed', request.url));
  }

  if (!code || !state) {
    logger.error('[MicrosoftCallback] Missing code or state');
    return NextResponse.redirect(new URL('/calendar-aggregator?error=invalid_request', request.url));
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        code: code,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      logger.error('[MicrosoftCallback] Token exchange failed', { status: tokenResponse.status, error });
      return NextResponse.redirect(new URL('/calendar-aggregator?error=token_exchange_failed', request.url));
    }

    const tokens = await tokenResponse.json();
    logger.info('[MicrosoftCallback] Tokens received successfully');

    // Get user info
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      logger.error('[MicrosoftCallback] Failed to get user info');
      return NextResponse.redirect(new URL('/calendar-aggregator?error=user_info_failed', request.url));
    }

    const user = await userResponse.json();
    logger.info('[MicrosoftCallback] User authenticated', { 
      userId: user.id, 
      email: user.mail || user.userPrincipalName 
    });

    // TODO: Store tokens securely in database
    // For now, we'll store in a secure session cookie
    const response = NextResponse.redirect(new URL('/calendar-aggregator?success=microsoft_connected', request.url));
    
    // In production, use proper session management
    response.cookies.set('ms_auth', 'connected', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;

  } catch (error) {
    logger.error('[MicrosoftCallback] Unexpected error', error);
    return NextResponse.redirect(new URL('/calendar-aggregator?error=unexpected_error', request.url));
  }
}