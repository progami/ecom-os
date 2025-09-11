import { NextResponse } from 'next/server';
import BankReconciliationService from '@/lib/services/BankReconciliationService';
import logger from '@/utils/logger';

const bankReconciliationService = BankReconciliationService.getInstance();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { csvContent, fileName } = body;
    
    if (!csvContent || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const summary = await bankReconciliationService.processBankStatement(csvContent, fileName);
    
    return NextResponse.json({
      ...summary,
      lastReconciledDate: summary.lastReconciledDate.toISOString()
    });
  } catch (error) {
    logger.error('Error processing bank statement:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process bank statement' },
      { status: 500 }
    );
  }
}