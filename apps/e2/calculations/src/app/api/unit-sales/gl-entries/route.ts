import { NextRequest, NextResponse } from 'next/server';
import RevenueService from '@/lib/services/RevenueService';
import logger from '@/utils/logger';

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
    const entries = await revenueService.getRevenueForGL(
      new Date(startDate),
      new Date(endDate)
    );

    return NextResponse.json(entries);
  } catch (error) {
    logger.error('Error fetching revenue for GL:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue entries' },
      { status: 500 }
    );
  }
}