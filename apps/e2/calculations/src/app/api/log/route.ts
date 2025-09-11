// src/app/api/log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/utils/logger'; // Import your server-side logger

export async function POST(request: NextRequest) {
  try {
    const { level, message, details } = await request.json();

    switch (level) {
      case 'info':
        logger.info(message, details);
        break;
      case 'warn':
        logger.warn(message, details);
        break;
      case 'error':
        logger.error(message, details);
        break;
      case 'debug':
        logger.debug(message, details);
        break;
      default:
        logger.info(`Unknown log level: ${level} - ${message}`, details);
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    logger.error('Failed to process client log:', error);
    return NextResponse.json({ status: 'error', message: 'Failed to process log' }, { status: 500 });
  }
}