import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'https://graph.microsoft.com/Calendars.Read',
  'https://graph.microsoft.com/Calendars.ReadWrite'
];

export async function GET() {
  logger.info('[MicrosoftAuth] OAuth flow initiated');

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    logger.error('[MicrosoftAuth] Missing Microsoft OAuth configuration');
    return NextResponse.json(
      { error: 'Microsoft OAuth not configured' },
      { status: 500 }
    );
  }

  // Generate state for CSRF protection
  const state = Buffer.from(JSON.stringify({
    provider: 'microsoft',
    timestamp: Date.now(),
    random: Math.random().toString(36).substring(7)
  })).toString('base64');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: SCOPES.join(' '),
    state: state
  });

  const authUrl = `${MICROSOFT_AUTH_URL}?${params.toString()}`;
  
  logger.info('[MicrosoftAuth] Redirecting to Microsoft login');
  return NextResponse.redirect(authUrl);
}