import { NextResponse } from 'next/server';
import { structuredLogger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { error, errorInfo, url, userAgent } = body;
    
    // Log to development.log
    const fs = require('fs');
    const errorLog = `
=== CLIENT-SIDE ERROR ${new Date().toISOString()} ===
URL: ${url}
User Agent: ${userAgent}
Error: ${error.message || error}
Stack: ${error.stack || 'No stack trace'}
Component Stack: ${errorInfo?.componentStack || 'No component stack'}
=== END CLIENT ERROR ===
`;
    
    fs.appendFileSync('development.log', errorLog);
    
    structuredLogger.error('[Client Error]', {
      error: error.message || error,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      url,
      userAgent
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to log client error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}