export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  status: 'confirmed' | 'tentative' | 'cancelled';
  visibility: 'default' | 'public' | 'private';
  attendees?: Attendee[];
  organizer?: Organizer;
  recurrence?: RecurrenceRule;
  reminders?: Reminder[];
  metadata?: Record<string, unknown>;
}

export interface Attendee {
  email: string;
  name?: string;
  status: 'accepted' | 'declined' | 'tentative' | 'needs-action';
  organizer: boolean;
  optional: boolean;
}

export interface Organizer {
  email: string;
  name?: string;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  count?: number;
  until?: Date;
  byDay?: string[];
  byMonth?: number[];
  byMonthDay?: number[];
}

export interface Reminder {
  method: 'email' | 'popup';
  minutes: number;
}

export interface CalendarCredentials {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  apiKey?: string;
  apiSecret?: string;
  [key: string]: string | Date | undefined;
}

export interface SyncResult {
  success: boolean;
  eventsAdded: number;
  eventsUpdated: number;
  eventsDeleted: number;
  lastSyncToken?: string;
  error?: string;
}

export interface CalendarAdapter {
  provider: string;
  
  authenticate(credentials: CalendarCredentials): Promise<boolean>;
  
  getEvents(params: {
    startDate: Date;
    endDate: Date;
    syncToken?: string;
  }): Promise<{
    events: CalendarEvent[];
    nextSyncToken?: string;
  }>;
  
  createEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent>;
  
  updateEvent(id: string, event: Partial<CalendarEvent>): Promise<CalendarEvent>;
  
  deleteEvent(id: string): Promise<void>;
  
  subscribeToWebhooks?(webhookUrl: string): Promise<string>;
  
  unsubscribeFromWebhooks?(subscriptionId: string): Promise<void>;
  
  validateWebhookPayload?(payload: unknown, signature?: string): boolean;
}