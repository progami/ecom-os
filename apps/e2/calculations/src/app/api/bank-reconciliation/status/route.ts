import { NextResponse } from 'next/server';
import BankReconciliationService from '@/lib/services/BankReconciliationService';
import logger from '@/utils/logger';

const bankReconciliationService = BankReconciliationService.getInstance();

export async function GET() {
  try {
    const status = await bankReconciliationService.getReconciliationStatus();
    
    return NextResponse.json({
      ...status,
      lastReconciledDate: status.lastReconciledDate ? status.lastReconciledDate.toISOString() : null
    });
  } catch (error) {
    logger.error('Error fetching reconciliation status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation status' },
      { status: 500 }
    );
  }
}