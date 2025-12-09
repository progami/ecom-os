import { NextRequest, NextResponse } from 'next/server';
import { GoogleCalendarService } from '@/lib/services/calendar/google-calendar';
import { MicrosoftCalendarService } from '@/lib/services/calendar/microsoft-calendar';
import { CalendarServiceFactory } from '@/lib/services/calendar/factory';
import logger from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerParam as 'google' | 'microsoft';
  
  try {
    let authUrl: string;
    
    switch (provider) {
      case 'google': {
        const config = CalendarServiceFactory.getGoogleConfig();
        const service = new GoogleCalendarService(config);
        authUrl = service.getAuthorizationUrl();
        break;
      }
      case 'microsoft': {
        const config = CalendarServiceFactory.getMicrosoftConfig();
        const service = new MicrosoftCalendarService(config);
        authUrl = await service.getAuthorizationUrl();
        break;
      }
      default:
        return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    logger.info(`[OAuth] Redirecting to ${provider} auth`);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    logger.error(`[OAuth] Failed to initiate ${provider} auth`, error);
    return NextResponse.json({ error: 'Failed to initiate authentication' }, { status: 500 });
  }
}