import { CalendarAdapter, CalendarCredentials, CalendarEvent } from './types';
import { encryption } from '@/lib/utils/encryption';

export abstract class BaseCalendarAdapter implements CalendarAdapter {
  abstract provider: string;
  protected credentials: CalendarCredentials | null = null;

  abstract authenticate(credentials: CalendarCredentials): Promise<boolean>;
  
  abstract getEvents(params: {
    startDate: Date;
    endDate: Date;
    syncToken?: string;
  }): Promise<{
    events: CalendarEvent[];
    nextSyncToken?: string;
  }>;
  
  abstract createEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent>;
  
  abstract updateEvent(id: string, event: Partial<CalendarEvent>): Promise<CalendarEvent>;
  
  abstract deleteEvent(id: string): Promise<void>;

  protected encryptCredentials(credentials: CalendarCredentials): string {
    return encryption.encrypt(JSON.stringify(credentials));
  }

  protected decryptCredentials(encryptedCredentials: string): CalendarCredentials {
    return JSON.parse(encryption.decrypt(encryptedCredentials));
  }

  protected async refreshTokenIfNeeded(): Promise<void> {
    if (!this.credentials?.refreshToken || !this.credentials?.expiresAt) {
      return;
    }

    const now = new Date();
    const expiresAt = new Date(this.credentials.expiresAt);
    
    if (expiresAt > now) {
      return;
    }

    await this.refreshAccessToken();
  }

  protected abstract refreshAccessToken(): Promise<void>;
}