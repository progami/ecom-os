import { GoogleCalendarService } from './google-calendar';
import { MicrosoftCalendarService } from './microsoft-calendar';
import { CalendarService, OAuthConfig } from './types';

export class CalendarServiceFactory {
  static create(provider: 'google' | 'microsoft', config: OAuthConfig): CalendarService {
    switch (provider) {
      case 'google':
        return new GoogleCalendarService(config);
      case 'microsoft':
        return new MicrosoftCalendarService(config);
      default:
        throw new Error(`Unsupported calendar provider: ${provider}`);
    }
  }

  static getGoogleConfig(): OAuthConfig {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: process.env.GOOGLE_REDIRECT_URI!,
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
      ],
    };
  }

  static getMicrosoftConfig(): OAuthConfig {
    return {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirectUri: process.env.MICROSOFT_REDIRECT_URI!,
      authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      scopes: [
        'https://graph.microsoft.com/calendars.read',
        'https://graph.microsoft.com/calendars.readwrite',
        'offline_access',
      ],
    };
  }
}