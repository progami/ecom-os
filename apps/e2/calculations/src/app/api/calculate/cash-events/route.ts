// src/app/api/calculate/cash-events/route.ts

import { NextRequest, NextResponse } from 'next/server';
import CashEventService from '@/services/database/CashEventService';
import logger from '@/utils/logger';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const months = parseInt(searchParams.get('months') || '12');
    const type = searchParams.get('type') as 'fixed' | 'variable' | null;

    const cashEventService = CashEventService.getInstance();
    
    // Seed initial events if database is empty (one-time operation)
    await cashEventService.seedInitialEvents();

    // Get events based on filters
    let upcomingEvents;
    if (type && ['fixed', 'variable'].includes(type)) {
      upcomingEvents = await cashEventService.getEventsByType(type, months);
    } else {
      upcomingEvents = await cashEventService.getUpcomingEvents(months);
    }

    // Calculate summary statistics
    const totalInflows = upcomingEvents
      .filter(e => e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);
    
    const totalOutflows = upcomingEvents
      .filter(e => e.amount < 0)
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    const netCashImpact = totalInflows - totalOutflows;

    // Group events by month
    const startDate = new Date();
    const eventsByMonth = upcomingEvents.reduce((acc, event) => {
      const monthDiff = (event.date.getFullYear() - startDate.getFullYear()) * 12 + 
                        (event.date.getMonth() - startDate.getMonth()) + 1;
      if (!acc[monthDiff]) {
        acc[monthDiff] = [];
      }
      acc[monthDiff].push(event);
      return acc;
    }, {} as Record<number, typeof upcomingEvents>);

    // Create monthly summary
    const monthlySummary = Object.entries(eventsByMonth).map(([month, events]) => ({
      month: parseInt(month),
      events: events.length,
      totalAmount: events.reduce((sum, e) => sum + e.amount, 0),
      inflows: events.filter(e => e.amount > 0).reduce((sum, e) => sum + e.amount, 0),
      outflows: events.filter(e => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0)
    }));

    const responseData = {
      events: upcomingEvents,
      summary: {
        totalEvents: upcomingEvents.length,
        totalInflows,
        totalOutflows,
        netCashImpact,
        averageEventSize: upcomingEvents.length > 0 
          ? Math.abs(netCashImpact / upcomingEvents.length)
          : 0
      },
      monthlySummary: monthlySummary.sort((a, b) => a.month - b.month),
      filters: {
        months,
        type: type || 'all'
      },
      metadata: {
        retrievedAt: new Date().toISOString()
      }
    };

    return NextResponse.json(responseData);

  } catch (error) {
    logger.error('Cash Events API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve cash events', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// POST endpoint to add new scheduled events
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, month, description, amount, type = 'variable', category = 'other' } = body;

    // Validate required fields
    if (!description || amount === undefined) {
      return NextResponse.json({ 
        error: 'Missing required fields: description, amount' 
      }, { status: 400 });
    }

    // Handle date - either direct date or month offset
    let eventDate: Date;
    if (date) {
      eventDate = new Date(date);
    } else if (month) {
      if (month < 1 || month > 60) {
        return NextResponse.json({ 
          error: 'Month must be between 1 and 60' 
        }, { status: 400 });
      }
      const currentDate = new Date();
      eventDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + month - 1);
    } else {
      return NextResponse.json({ 
        error: 'Must provide either date or month' 
      }, { status: 400 });
    }

    if (!['fixed', 'variable'].includes(type)) {
      return NextResponse.json({ 
        error: 'Type must be either "fixed" or "variable"' 
      }, { status: 400 });
    }

    // Add event to database
    const cashEventService = CashEventService.getInstance();
    const newEvent = await cashEventService.createCashEvent({
      date: eventDate,
      amount,
      description,
      type: type as 'fixed' | 'variable',
      category
    });

    return NextResponse.json({
      success: true,
      event: {
        id: newEvent.id,
        date: newEvent.date,
        description: newEvent.description,
        amount: newEvent.amount.toNumber(),
        type: newEvent.type,
        category: newEvent.category
      },
      message: 'Scheduled event added successfully'
    });

  } catch (error) {
    logger.error('Cash Events POST Error:', error);
    return NextResponse.json({ 
      error: 'Failed to add scheduled event', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// DELETE endpoint to remove scheduled events
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('id');

    if (!eventId) {
      return NextResponse.json({ 
        error: 'Must provide eventId to delete' 
      }, { status: 400 });
    }

    // Delete event from database
    const cashEventService = CashEventService.getInstance();
    await cashEventService.deleteCashEvent(eventId);

    return NextResponse.json({
      success: true,
      message: 'Event deleted successfully',
      deletedId: eventId
    });

  } catch (error) {
    logger.error('Cash Events DELETE Error:', error);
    return NextResponse.json({ 
      error: 'Failed to delete scheduled event', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// PUT endpoint to update scheduled events
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('id');
    
    if (!eventId) {
      return NextResponse.json({ 
        error: 'Must provide eventId to update' 
      }, { status: 400 });
    }

    const body = await req.json();
    const cashEventService = CashEventService.getInstance();
    
    const updatedEvent = await cashEventService.updateCashEvent(eventId, body);

    return NextResponse.json({
      success: true,
      event: {
        id: updatedEvent.id,
        date: updatedEvent.date,
        description: updatedEvent.description,
        amount: updatedEvent.amount.toNumber(),
        type: updatedEvent.type,
        category: updatedEvent.category,
        status: updatedEvent.status
      },
      message: 'Event updated successfully'
    });

  } catch (error) {
    logger.error('Cash Events PUT Error:', error);
    return NextResponse.json({ 
      error: 'Failed to update scheduled event', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}