import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { CalendarService, OAuthConfig } from './types';
import { CalendarEvent } from '@/lib/types/calendar';
import logger from '@/lib/logger';

export class MicrosoftCalendarService implements CalendarService {
  private msalClient: ConfidentialClientApplication;
  
  constructor(private config: OAuthConfig) {
    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        authority: 'https://login.microsoftonline.com/common',
      },
    });
  }

  private getGraphClient(accessToken: string): Client {
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });
  }

  async getEvents(startDate: Date, endDate: Date, accessToken: string): Promise<CalendarEvent[]> {
    try {
      const client = this.getGraphClient(accessToken);
      
      const response = await client
        .api('/me/calendar/events')
        .query({
          startDateTime: startDate.toISOString(),
          endDateTime: endDate.toISOString(),
          $orderby: 'start/dateTime',
          $select: 'id,subject,body,start,end,location,attendees,isAllDay,showAs',
        })
        .get();

      return (response.value || []).map((event: any) => this.mapMicrosoftEventToCalendarEvent(event));
    } catch (error) {
      logger.error('[MicrosoftCalendar] Failed to fetch events', error);
      throw error;
    }
  }

  async getEvent(eventId: string, accessToken: string): Promise<CalendarEvent | null> {
    try {
      const client = this.getGraphClient(accessToken);
      
      const event = await client
        .api(`/me/calendar/events/${eventId}`)
        .select('id,subject,body,start,end,location,attendees,isAllDay,showAs')
        .get();

      return this.mapMicrosoftEventToCalendarEvent(event);
    } catch (error) {
      logger.error('[MicrosoftCalendar] Failed to fetch event', error);
      return null;
    }
  }

  async createEvent(event: Omit<CalendarEvent, 'id' | 'provider' | 'providerEventId'>, accessToken: string): Promise<CalendarEvent> {
    try {
      const client = this.getGraphClient(accessToken);
      
      const newEvent = await client
        .api('/me/calendar/events')
        .post({
          subject: event.title,
          body: {
            contentType: 'text',
            content: event.description || '',
          },
          start: {
            dateTime: event.start.toISOString(),
            timeZone: 'UTC',
          },
          end: {
            dateTime: event.end.toISOString(),
            timeZone: 'UTC',
          },
          location: {
            displayName: event.location || '',
          },
          attendees: event.attendees?.map(email => ({
            emailAddress: { address: email },
            type: 'required',
          })) || [],
          isAllDay: event.isAllDay,
        });

      return this.mapMicrosoftEventToCalendarEvent(newEvent);
    } catch (error) {
      logger.error('[MicrosoftCalendar] Failed to create event', error);
      throw error;
    }
  }

  async updateEvent(eventId: string, event: Partial<CalendarEvent>, accessToken: string): Promise<CalendarEvent> {
    try {
      const client = this.getGraphClient(accessToken);
      
      const updateData: any = {};
      if (event.title) updateData.subject = event.title;
      if (event.description !== undefined) {
        updateData.body = {
          contentType: 'text',
          content: event.description || '',
        };
      }
      if (event.location !== undefined) {
        updateData.location = {
          displayName: event.location || '',
        };
      }
      if (event.start) {
        updateData.start = {
          dateTime: event.start.toISOString(),
          timeZone: 'UTC',
        };
      }
      if (event.end) {
        updateData.end = {
          dateTime: event.end.toISOString(),
          timeZone: 'UTC',
        };
      }
      if (event.attendees) {
        updateData.attendees = event.attendees.map(email => ({
          emailAddress: { address: email },
          type: 'required',
        }));
      }
      if (event.isAllDay !== undefined) {
        updateData.isAllDay = event.isAllDay;
      }

      const updatedEvent = await client
        .api(`/me/calendar/events/${eventId}`)
        .patch(updateData);

      return this.mapMicrosoftEventToCalendarEvent(updatedEvent);
    } catch (error) {
      logger.error('[MicrosoftCalendar] Failed to update event', error);
      throw error;
    }
  }

  async deleteEvent(eventId: string, accessToken: string): Promise<void> {
    try {
      const client = this.getGraphClient(accessToken);
      
      await client
        .api(`/me/calendar/events/${eventId}`)
        .delete();
    } catch (error) {
      logger.error('[MicrosoftCalendar] Failed to delete event', error);
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
    try {
      const result = await this.msalClient.acquireTokenByRefreshToken({
        refreshToken,
        scopes: this.config.scopes,
      });

      return {
        accessToken: result.accessToken,
        refreshToken: undefined, // Microsoft doesn't return a new refresh token
        expiresIn: result.expiresOn ? Math.floor((result.expiresOn.getTime() - Date.now()) / 1000) : 3600,
      };
    } catch (error) {
      logger.error('[MicrosoftCalendar] Failed to refresh token', error);
      throw error;
    }
  }

  getAuthorizationUrl(): string {
    return this.msalClient.getAuthCodeUrl({
      scopes: this.config.scopes,
      redirectUri: this.config.redirectUri,
    });
  }

  async getTokenFromCode(code: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
    try {
      const result = await this.msalClient.acquireTokenByCode({
        code,
        scopes: this.config.scopes,
        redirectUri: this.config.redirectUri,
      });

      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken || undefined,
        expiresIn: result.expiresOn ? Math.floor((result.expiresOn.getTime() - Date.now()) / 1000) : 3600,
      };
    } catch (error) {
      logger.error('[MicrosoftCalendar] Failed to get token from code', error);
      throw error;
    }
  }

  private mapMicrosoftEventToCalendarEvent(msEvent: any): CalendarEvent {
    return {
      id: `microsoft_${msEvent.id}`,
      title: msEvent.subject || 'Untitled Event',
      description: msEvent.body?.content || undefined,
      start: new Date(msEvent.start.dateTime),
      end: new Date(msEvent.end.dateTime),
      location: msEvent.location?.displayName || undefined,
      attendees: msEvent.attendees?.map((a: any) => a.emailAddress.address) || [],
      provider: {
        id: 'microsoft',
        name: 'Outlook Calendar',
        type: 'microsoft',
        color: '#0078D4',
        enabled: true,
      },
      providerEventId: msEvent.id,
      isAllDay: msEvent.isAllDay || false,
      status: msEvent.showAs === 'free' ? 'tentative' : 'confirmed',
    };
  }
}