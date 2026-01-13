import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

export async function GET() {
  logger.debug('[HealthAPI] Health check requested');
  
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'jason',
    version: '0.1.0'
  });
}