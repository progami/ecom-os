import { NextRequest, NextResponse } from 'next/server';
import { CalendarServiceFactory } from '@/lib/services/calendar/factory';
import { GoogleCalendarService } from '@/lib/services/calendar/google-calendar';
import { MicrosoftCalendarService } from '@/lib/services/calendar/microsoft-calendar';
import { CalendarEvent } from '@/lib/types/calendar';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import logger from '@/lib/logger';

interface CalendarSession {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

async function getCalendarSessions(): Promise<CalendarSession[]> {
  const cookieStore = await cookies();
  const sessions: CalendarSession[] = [];
  
  // Check for Google session
  const googleSession = cookieStore.get('google_calendar_session');
  if (googleSession) {
    try {
      const decoded = jwt.verify(googleSession.value, process.env.JWT_SECRET || 'dev-secret') as CalendarSession;
      sessions.push(decoded);
    } catch (error) {
      logger.error('[CalendarAPI] Invalid Google session', error);
    }
  }
  
  // Check for Microsoft session
  const microsoftSession = cookieStore.get('microsoft_calendar_session');
  if (microsoftSession) {
    try {
      const decoded = jwt.verify(microsoftSession.value, process.env.JWT_SECRET || 'dev-secret') as CalendarSession;
      sessions.push(decoded);
    } catch (error) {
      logger.error('[CalendarAPI] Invalid Microsoft session', error);
    }
  }
  
  return sessions;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start') || new Date().toISOString();
    const endDate = searchParams.get('end') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const sessions = await getCalendarSessions();
    const allEvents: CalendarEvent[] = [];
    
    // Fetch events from all connected calendars
    for (const session of sessions) {
      try {
        let service;
        let config;
        
        switch (session.provider) {
          case 'google':
            config = CalendarServiceFactory.getGoogleConfig();
            service = new GoogleCalendarService(config);
            break;
          case 'microsoft':
            config = CalendarServiceFactory.getMicrosoftConfig();
            service = new MicrosoftCalendarService(config);
            break;
          default:
            continue;
        }
        
        // Check if token needs refresh
        const expiresAt = new Date(session.expiresAt);
        let accessToken = session.accessToken;
        
        if (expiresAt < new Date() && session.refreshToken) {
          try {
            const newTokens = await service.refreshToken(session.refreshToken);
            accessToken = newTokens.accessToken;
            
            // Update session cookie with new token
            const newSession = jwt.sign(
              {
                ...session,
                accessToken: newTokens.accessToken,
                expiresAt: new Date(Date.now() + newTokens.expiresIn * 1000).toISOString(),
              },
              process.env.JWT_SECRET || 'dev-secret',
              { expiresIn: '7d' }
            );
            
            const cookieStore = await cookies();
            cookieStore.set(`${session.provider}_calendar_session`, newSession, {
              httpOnly: true,
              secure: true,
              sameSite: 'strict',
              maxAge: 7 * 24 * 60 * 60,
            });
          } catch (error) {
            logger.error(`[CalendarAPI] Failed to refresh ${session.provider} token`, error);
            continue;
          }
        }
        
        const events = await service.getEvents(
          new Date(startDate),
          new Date(endDate),
          accessToken
        );
        
        allEvents.push(...events);
      } catch (error) {
        logger.error(`[CalendarAPI] Failed to fetch ${session.provider} events`, error);
      }
    }
    
    // Sort events by start date
    allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
    
    logger.info(`[CalendarAPI] Fetched ${allEvents.length} events from ${sessions.length} calendars`);
    
    return NextResponse.json({
      events: allEvents,
      connectedCalendars: sessions.map(s => s.provider),
    });
  } catch (error) {
    logger.error('[CalendarAPI] Failed to fetch calendar events', error);
    return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 });
  }
}