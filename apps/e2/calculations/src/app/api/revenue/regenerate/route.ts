import { NextRequest, NextResponse } from 'next/server';
import RevenueService from '@/lib/services/RevenueService';
import logger from '@/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const revenueService = await RevenueService.getInstance();
    
    // Clear existing forecast calculations
    await revenueService.clearCalculations(false); // false for forecast
    
    // Generate new forecasts
    const forecasts = await revenueService.generateRevenueForecasts();

    return NextResponse.json({
      success: true,
      count: forecasts.length,
      message: `Regenerated ${forecasts.length} revenue forecasts`
    });
  } catch (error) {
    logger.error('Error regenerating revenue forecasts:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate revenue forecasts' },
      { status: 500 }
    );
  }
}