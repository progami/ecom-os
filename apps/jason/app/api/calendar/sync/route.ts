import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

export async function POST(request: Request) {
  // Generate a request ID for tracking
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const contextLogger = logger.child({ requestId });
  
  contextLogger.info('[CalendarSync] Sync request received');
  
  try {
    const data = await request.json();
    
    // Log the request (sanitized)
    contextLogger.debug('[CalendarSync] Processing sync request', {
      userId: data.userId,
      calendarTypes: data.calendarTypes,
      dateRange: data.dateRange
    });
    
    // Simulate sync operation
    const syncResults = {
      outlook: { status: 'success', events: 15 },
      google: { status: 'success', events: 8 },
      trademan: { status: 'failed', error: 'Connection timeout' }
    };
    
    // Log individual sync results
    Object.entries(syncResults).forEach(([provider, result]) => {
      if (result.status === 'success') {
        contextLogger.info(`[CalendarSync] ${provider} sync completed`, {
          provider,
          eventCount: result.events
        });
      } else {
        contextLogger.warn(`[CalendarSync] ${provider} sync failed`, {
          provider,
          error: result.error
        });
      }
    });
    
    // Calculate summary
    const totalEvents = Object.values(syncResults)
      .filter(r => r.status === 'success')
      .reduce((sum, r) => sum + (r.events || 0), 0);
    
    contextLogger.info('[CalendarSync] Sync operation completed', {
      totalEvents,
      successfulProviders: 2,
      failedProviders: 1,
      duration: '1.2s'
    });
    
    return NextResponse.json({
      success: true,
      requestId,
      results: syncResults,
      summary: {
        totalEvents,
        lastSync: new Date().toISOString()
      }
    });
    
  } catch (error) {
    contextLogger.error('[CalendarSync] Sync operation failed', error, {
      path: request.url
    });
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to sync calendars',
        requestId 
      }, 
      { status: 500 }
    );
  }
}

export async function GET() {
  logger.info('[CalendarSync] Sync status check');
  
  return NextResponse.json({
    status: 'ready',
    supportedProviders: ['outlook', 'google', 'trademan', 'personal'],
    lastSync: new Date(Date.now() - 1000 * 60 * 15).toISOString() // 15 minutes ago
  });
}