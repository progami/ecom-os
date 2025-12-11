'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Calendar, RefreshCw, CheckCircle, Plus, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCalendarEvents } from '@/lib/hooks/use-calendar-events';

function CalendarAggregatorContent() {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const searchParams = useSearchParams();
  
  // Get today's start and end for fetching events
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const { events, connectedCalendars, isLoading, error, refetch } = useCalendarEvents(today, tomorrow);
  
  // Filter today's events
  const todaysEvents = events.filter(event => {
    const eventDate = new Date(event.start);
    return eventDate >= today && eventDate < tomorrow;
  });
  
  // Get this week's events count
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  
  const weekEvents = events.filter(event => {
    const eventDate = new Date(event.start);
    return eventDate >= weekStart && eventDate < weekEnd;
  });
  
  useEffect(() => {
    // Check for success/error messages from OAuth callbacks
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    if (success) {
      console.log('[CLIENT] [CalendarPage] OAuth success:', success);
      refetch(); // Refresh calendar data after successful connection
    }
    
    if (error) {
      console.error('[CLIENT] [CalendarPage] OAuth error:', error);
      // You could show an error toast here
    }
  }, [searchParams, refetch]);

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Calendar Aggregator</h1>
          <p className="text-muted-foreground">Manage and sync all your calendars in one place.</p>
        </div>

        {/* Connected Calendars */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Connected Calendars</h2>
            <Button size="sm" onClick={() => setShowConnectModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Calendar
            </Button>
          </div>
          
          <div className="grid gap-4">
            {connectedCalendars.length === 0 && !isLoading ? (
              <div className="bg-card p-8 rounded-lg border text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">No calendars connected yet</p>
                <Button onClick={() => setShowConnectModal(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Connect Your First Calendar
                </Button>
              </div>
            ) : (
              <>
                {connectedCalendars.includes('google') && (
                  <div className="bg-card p-4 rounded-lg border flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center">
                        <span className="text-red-500 font-bold text-xl">G</span>
                      </div>
                      <div>
                        <h3 className="font-medium">Google Calendar</h3>
                        <p className="text-sm text-muted-foreground">Connected</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">Active</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={refetch}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {connectedCalendars.includes('microsoft') && (
                  <div className="bg-card p-4 rounded-lg border flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                        <span className="text-blue-500 font-bold text-xl">M</span>
                      </div>
                      <div>
                        <h3 className="font-medium">Microsoft Outlook</h3>
                        <p className="text-sm text-muted-foreground">Connected</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">Active</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={refetch}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Calendar Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card p-6 rounded-lg border">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Connected Calendars</h3>
            <p className="text-3xl font-bold">{connectedCalendars.length}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {connectedCalendars.length === 0 ? 'Get started' : 'Active connections'}
            </p>
          </div>
          <div className="bg-card p-6 rounded-lg border">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Today&apos;s Events</h3>
            <p className="text-3xl font-bold">{todaysEvents.length}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {todaysEvents.length === 0 ? 'No events today' : 'Scheduled events'}
            </p>
          </div>
          <div className="bg-card p-6 rounded-lg border">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">This Week</h3>
            <p className="text-3xl font-bold">{weekEvents.length}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {weekEvents.length > 10 ? 'Busy week ahead' : 'Events scheduled'}
            </p>
          </div>
        </div>

        {/* Today's Schedule */}
        <div className="bg-card p-6 rounded-lg border">
          <h2 className="text-xl font-semibold mb-4">Today&apos;s Schedule</h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-4 bg-muted rounded" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/3" />
                      <div className="h-3 bg-muted rounded w-2/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : todaysEvents.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {connectedCalendars.length === 0 
                  ? 'Connect a calendar to see your events' 
                  : 'No events scheduled for today'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaysEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-start gap-4">
                  <div className="text-sm text-muted-foreground w-16">
                    {new Date(event.start).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: false 
                    })}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: event.provider.color }}
                      />
                      <h4 className="font-medium">{event.title}</h4>
                      <span 
                        className="text-xs px-2 py-1 rounded"
                        style={{ 
                          backgroundColor: `${event.provider.color}20`,
                          color: event.provider.color 
                        }}
                      >
                        {event.provider.name}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                    )}
                    {event.location && (
                      <p className="text-sm text-muted-foreground mt-1">📍 {event.location}</p>
                    )}
                  </div>
                </div>
              ))}
              {todaysEvents.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  +{todaysEvents.length - 5} more events
                </p>
              )}
            </div>
          )}
          <div className="mt-4 pt-4 border-t">
            <Link href="/calendar-aggregator/dashboard">
              <Button variant="outline" className="w-full">View Full Calendar</Button>
            </Link>
          </div>
        </div>

        {/* Connect Calendar Modal */}
        {showConnectModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-card/95 glass p-6 rounded-xl max-w-md w-full mx-4 border border-border/50 animate-scale-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Connect Calendar</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConnectModal(false)}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <p className="text-muted-foreground mb-6">
                Choose a calendar provider to connect. You&apos;ll be redirected to sign in and authorize access.
              </p>
              
              <div className="space-y-3">
                <Link href="/api/auth/microsoft" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <div className="w-8 h-8 mr-3 bg-blue-500/10 rounded flex items-center justify-center">
                      <span className="text-blue-500 font-bold">M</span>
                    </div>
                    Microsoft Outlook
                  </Button>
                </Link>
                
                <Link href="/api/auth/google" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <div className="w-8 h-8 mr-3 bg-red-500/10 rounded flex items-center justify-center">
                      <span className="text-red-500 font-bold">G</span>
                    </div>
                    Google Calendar
                  </Button>
                </Link>
                
                <Button variant="outline" className="w-full justify-start" disabled>
                  <div className="w-8 h-8 mr-3 bg-orange-500/10 rounded flex items-center justify-center">
                    <span className="text-orange-500 font-bold">T</span>
                  </div>
                  Trademan (Coming Soon)
                </Button>
                
                <Button variant="outline" className="w-full justify-start" disabled>
                  <div className="w-8 h-8 mr-3 bg-purple-500/10 rounded flex items-center justify-center">
                    <span className="text-purple-500 font-bold">T</span>
                  </div>
                  Targon (Coming Soon)
                </Button>
              </div>
              
              <div className="mt-6 p-4 bg-muted/30 glass rounded-lg text-sm border border-border/50">
                <p className="font-medium mb-1 flex items-center gap-2">
                  <div className="p-1 bg-green-500/10 rounded">
                    <Settings className="h-4 w-4 text-green-500" />
                  </div>
                  Secure Authentication
                </p>
                <p className="text-muted-foreground">
                  We use OAuth 2.0 for secure authentication. Your password is never shared with us.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function CalendarAggregator() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </div>
      </AppLayout>
    }>
      <CalendarAggregatorContent />
    </Suspense>
  );
}