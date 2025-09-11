import { NextResponse } from 'next/server';
import ForecastDefinitionService from '@/lib/services/ForecastDefinitionService';
import logger from '@/utils/logger';

const forecastService = ForecastDefinitionService.getInstance();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromDateStr = searchParams.get('fromDate');
    const toDateStr = searchParams.get('toDate');
    
    const fromDate = fromDateStr ? new Date(fromDateStr) : undefined;
    const toDate = toDateStr ? new Date(toDateStr) : undefined;
    
    const forecasts = await forecastService.generateForecasts(fromDate, toDate);
    
    return NextResponse.json({
      forecasts: forecasts.map(forecast => ({
        ...forecast,
        date: forecast.date.toISOString()
      }))
    });
  } catch (error) {
    logger.error('Error generating forecasts:', error);
    return NextResponse.json(
      { error: 'Failed to generate forecasts' },
      { status: 500 }
    );
  }
}