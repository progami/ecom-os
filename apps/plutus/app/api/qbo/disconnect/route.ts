import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createLogger } from '@targon/logger';

const logger = createLogger({ name: 'qbo-disconnect' });

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('qbo_connection');

    logger.info('QBO connection disconnected');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to disconnect QBO', error);
    return NextResponse.json({ success: false, error: 'Failed to disconnect' }, { status: 500 });
  }
}
