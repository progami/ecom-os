import { NextResponse } from 'next/server';
import CutoffDateService from '@/lib/services/CutoffDateService';
import logger from '@/utils/logger';

const cutoffDateService = CutoffDateService.getInstance();

export async function GET() {
  try {
    const cutoffDate = await cutoffDateService.getActiveCutoffDate();
    
    return NextResponse.json({
      cutoffDate: cutoffDate.toISOString()
    });
  } catch (error) {
    logger.error('Error fetching cutoff date:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cutoff date' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, fileName, transactionCount, totalAmount } = body;
    
    if (!date || !fileName || transactionCount === undefined || totalAmount === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    await cutoffDateService.updateCutoffDate(
      new Date(date),
      fileName,
      transactionCount,
      totalAmount
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error updating cutoff date:', error);
    return NextResponse.json(
      { error: 'Failed to update cutoff date' },
      { status: 500 }
    );
  }
}