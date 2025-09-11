import { NextResponse } from 'next/server';
import ForecastDefinitionService from '@/lib/services/ForecastDefinitionService';
import logger from '@/utils/logger';

const forecastService = ForecastDefinitionService.getInstance();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Convert date strings back to Date objects
    const definitionData = {
      ...body,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : undefined
    };
    
    await forecastService.createDefinition(definitionData);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error creating forecast definition:', error);
    return NextResponse.json(
      { error: 'Failed to create forecast definition' },
      { status: 500 }
    );
  }
}