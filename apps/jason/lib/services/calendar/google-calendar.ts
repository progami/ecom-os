import { google } from 'googleapis';
import { CalendarService, OAuthConfig } from './types';
import { CalendarEvent } from '@/lib/types/calendar';
import logger from '@/lib/logger';

interface GoogleCalendarEvent {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
  attendees?: Array<{ email?: string | null }> | null;
  status?: string | null;
}

export class GoogleCalendarService implements CalendarService {
  private oauth2Client;
  
  constructor(private config: OAuthConfig) {
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
  }

  async getEvents(startDate: Date, endDate: Date, accessToken: string): Promise<CalendarEvent[]> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return (response.data.items || []).map(event => this.mapGoogleEventToCalendarEvent(event));
    } catch (error) {
      logger.error('[GoogleCalendar] Failed to fetch events', error);
      throw error;
    }
  }

  async getEvent(eventId: string, accessToken: string): Promise<CalendarEvent | null> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      const response = await calendar.events.get({
        calendarId: 'primary',
        eventId,
      });

      return this.mapGoogleEventToCalendarEvent(response.data);
    } catch (error) {
      logger.error('[GoogleCalendar] Failed to fetch event', error);
      return null;
    }
  }

  async createEvent(event: Omit<CalendarEvent, 'id' | 'provider' | 'providerEventId'>, accessToken: string): Promise<CalendarEvent> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: event.title,
          description: event.description,
          location: event.location,
          start: event.isAllDay 
            ? { date: event.start.toISOString().split('T')[0] }
            : { dateTime: event.start.toISOString() },
          end: event.isAllDay
            ? { date: event.end.toISOString().split('T')[0] }
            : { dateTime: event.end.toISOString() },
          attendees: event.attendees?.map(email => ({ email })),
        },
      });

      return this.mapGoogleEventToCalendarEvent(response.data);
    } catch (error) {
      logger.error('[GoogleCalendar] Failed to create event', error);
      throw error;
    }
  }

  async updateEvent(eventId: string, event: Partial<CalendarEvent>, accessToken: string): Promise<CalendarEvent> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      const requestBody: Record<string, unknown> = {};
      if (event.title) requestBody.summary = event.title;
      if (event.description !== undefined) requestBody.description = event.description;
      if (event.location !== undefined) requestBody.location = event.location;
      if (event.start) {
        requestBody.start = event.isAllDay
          ? { date: event.start.toISOString().split('T')[0] }
          : { dateTime: event.start.toISOString() };
      }
      if (event.end) {
        requestBody.end = event.isAllDay
          ? { date: event.end.toISOString().split('T')[0] }
          : { dateTime: event.end.toISOString() };
      }
      if (event.attendees) {
        requestBody.attendees = event.attendees.map(email => ({ email }));
      }

      const response = await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody,
      });

      return this.mapGoogleEventToCalendarEvent(response.data);
    } catch (error) {
      logger.error('[GoogleCalendar] Failed to update event', error);
      throw error;
    }
  }

  async deleteEvent(eventId: string, accessToken: string): Promise<void> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      
      await calendar.events.delete({
        calendarId: 'primary',
        eventId,
      });
    } catch (error) {
      logger.error('[GoogleCalendar] Failed to delete event', error);
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      return {
        accessToken: credentials.access_token!,
        refreshToken: credentials.refresh_token || undefined,
        expiresIn: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600,
      };
    } catch (error) {
      logger.error('[GoogleCalendar] Failed to refresh token', error);
      throw error;
    }
  }

  getAuthorizationUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.scopes,
    });
  }

  async getTokenFromCode(code: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      
      return {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || undefined,
        expiresIn: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
      };
    } catch (error) {
      logger.error('[GoogleCalendar] Failed to get token from code', error);
      throw error;
    }
  }

  private mapGoogleEventToCalendarEvent(googleEvent: GoogleCalendarEvent): CalendarEvent {
    const startStr = googleEvent.start?.dateTime || googleEvent.start?.date || new Date().toISOString();
    const endStr = googleEvent.end?.dateTime || googleEvent.end?.date || new Date().toISOString();
    const isAllDay = !googleEvent.start?.dateTime;

    return {
      id: `google_${googleEvent.id}`,
      title: googleEvent.summary || 'Untitled Event',
      description: googleEvent.description ?? undefined,
      start: new Date(startStr),
      end: new Date(endStr),
      location: googleEvent.location ?? undefined,
      attendees: googleEvent.attendees?.map((a) => a.email).filter((e): e is string => e != null) || [],
      provider: {
        id: 'google',
        name: 'Google Calendar',
        type: 'google',
        color: '#4285F4',
        enabled: true,
      },
      providerEventId: googleEvent.id || '',
      isAllDay,
      status: googleEvent.status as CalendarEvent['status'],
    };
  }
}