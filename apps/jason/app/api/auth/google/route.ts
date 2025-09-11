import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events'
];

export async function GET() {
  logger.info('[GoogleAuth] OAuth flow initiated');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    logger.error('[GoogleAuth] Missing Google OAuth configuration');
    return NextResponse.json(
      { error: 'Google OAuth not configured' },
      { status: 500 }
    );
  }

  // Generate state for CSRF protection
  const state = Buffer.from(JSON.stringify({
    provider: 'google',
    timestamp: Date.now(),
    random: Math.random().toString(36).substring(7)
  })).toString('base64');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent', // Force consent to get refresh token
    state: state
  });

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  
  logger.info('[GoogleAuth] Redirecting to Google login');
  return NextResponse.redirect(authUrl);
}