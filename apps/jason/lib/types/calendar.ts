export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees?: string[];
  provider: CalendarProvider;
  providerEventId: string;
  isAllDay: boolean;
  status?: 'confirmed' | 'tentative' | 'cancelled';
}

export interface CalendarProvider {
  id: string;
  name: string;
  type: 'google' | 'microsoft' | 'personal';
  color: string;
  enabled: boolean;
  lastSync?: Date;
}

export interface CalendarAuthToken {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  userId: string;
}