import { CalendarEvent } from '@/lib/types/calendar';

export interface CalendarService {
  getEvents(startDate: Date, endDate: Date, accessToken: string): Promise<CalendarEvent[]>;
  getEvent(eventId: string, accessToken: string): Promise<CalendarEvent | null>;
  createEvent(event: Omit<CalendarEvent, 'id' | 'provider' | 'providerEventId'>, accessToken: string): Promise<CalendarEvent>;
  updateEvent(eventId: string, event: Partial<CalendarEvent>, accessToken: string): Promise<CalendarEvent>;
  deleteEvent(eventId: string, accessToken: string): Promise<void>;
  refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }>;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
}