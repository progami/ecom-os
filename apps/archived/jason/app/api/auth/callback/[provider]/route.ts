import { NextRequest, NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/services/calendar/google-calendar';
import { MicrosoftCalendarService } from '@/lib/services/calendar/microsoft-calendar';
import { CalendarServiceFactory } from '@/lib/services/calendar/factory';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import logger from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const provider = providerParam as 'google' | 'microsoft';

  if (error) {
    logger.error(`[OAuth] ${provider} auth error:`, error);
    return NextResponse.redirect(new URL('/calendar-aggregator?error=auth_failed', request.url));
  }

  if (!code) {
    logger.error(`[OAuth] No code received from ${provider}`);
    return NextResponse.redirect(new URL('/calendar-aggregator?error=no_code', request.url));
  }

  try {
    let tokens: { accessToken: string; refreshToken?: string; expiresIn: number };
    
    switch (provider) {
      case 'google': {
        const config = CalendarServiceFactory.getGoogleConfig();
        const service = new GoogleCalendarService(config);
        tokens = await service.getTokenFromCode(code);
        break;
      }
      case 'microsoft': {
        const config = CalendarServiceFactory.getMicrosoftConfig();
        const service = new MicrosoftCalendarService(config);
        tokens = await service.getTokenFromCode(code);
        break;
      }
      default:
        return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    // Create a session token with the calendar tokens
    // In production, store these securely in database
    const sessionToken = jwt.sign(
      {
        provider,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set(`${provider}_calendar_session`, sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    logger.info(`[OAuth] ${provider} authentication successful`);
    return NextResponse.redirect(new URL('/calendar-aggregator?success=true', request.url));
  } catch (error) {
    logger.error(`[OAuth] Failed to handle ${provider} callback`, error);
    return NextResponse.redirect(new URL('/calendar-aggregator?error=token_exchange_failed', request.url));
  }
}