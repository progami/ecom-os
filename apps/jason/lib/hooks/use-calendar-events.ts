import { useState, useEffect } from 'react';
import { CalendarEvent } from '@/lib/types/calendar';

interface UseCalendarEventsReturn {
  events: CalendarEvent[];
  connectedCalendars: string[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCalendarEvents(
  startDate?: Date,
  endDate?: Date
): UseCalendarEventsReturn {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [connectedCalendars, setConnectedCalendars] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (startDate) params.set('start', startDate.toISOString());
      if (endDate) params.set('end', endDate.toISOString());

      const response = await fetch(`/api/calendar/events?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch calendar events');
      }

      const data = await response.json();
      
      // Convert date strings back to Date objects
      const parsedEvents = data.events.map((event: any) => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end),
      }));

      setEvents(parsedEvents);
      setConnectedCalendars(data.connectedCalendars || []);
    } catch (err) {
      setError(err as Error);
      console.error('[useCalendarEvents] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [startDate?.getTime(), endDate?.getTime()]);

  return {
    events,
    connectedCalendars,
    isLoading,
    error,
    refetch: fetchEvents,
  };
}