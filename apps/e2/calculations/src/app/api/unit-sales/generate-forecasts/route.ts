import { NextRequest, NextResponse } from 'next/server';
import RevenueService from '@/lib/services/RevenueService';
import logger from '@/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate } = body;

    const revenueService = await RevenueService.getInstance();
    const forecasts = await revenueService.generateRevenueForecasts(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    return NextResponse.json({
      success: true,
      count: forecasts.length,
      message: `Generated ${forecasts.length} revenue forecasts`
    });
  } catch (error) {
    logger.error('Error generating revenue forecasts:', error);
    return NextResponse.json(
      { error: 'Failed to generate revenue forecasts' },
      { status: 500 }
    );
  }
}