import { NextRequest, NextResponse } from 'next/server';
import RevenueService from '@/lib/services/RevenueService';
import logger from '@/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const revenueService = await RevenueService.getInstance();
    
    // If no dates provided, get last 90 days
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    const summary = await revenueService.getSummaryMetrics(start, end);

    return NextResponse.json(summary);
  } catch (error) {
    logger.error('Error fetching revenue summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue summary' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const revenueService = await RevenueService.getInstance();
    const summary = await revenueService.getSummaryMetrics(
      new Date(startDate),
      new Date(endDate)
    );

    return NextResponse.json(summary);
  } catch (error) {
    logger.error('Error fetching revenue summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue summary' },
      { status: 500 }
    );
  }
}