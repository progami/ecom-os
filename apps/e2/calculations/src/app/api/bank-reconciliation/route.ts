import { NextRequest, NextResponse } from 'next/server';
import BankReconciliationService from '@/lib/services/BankReconciliationService';
import logger from '@/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'File must be a CSV' },
        { status: 400 }
      );
    }

    // Read file content
    const csvContent = await file.text();
    
    if (!csvContent.trim()) {
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      );
    }

    // Get reconciliation service instance
    const reconciliationService = BankReconciliationService.getInstance();

    // Parse CSV
    let bankTransactions;
    try {
      bankTransactions = reconciliationService.parseCSV(csvContent);
    } catch (parseError: any) {
      return NextResponse.json(
        { error: `Failed to parse CSV: ${parseError.message}` },
        { status: 400 }
      );
    }

    if (bankTransactions.length === 0) {
      return NextResponse.json(
        { error: 'No transactions found in CSV' },
        { status: 400 }
      );
    }

    // Match transactions
    const matches = await reconciliationService.matchTransactions(bankTransactions);

    // Reconcile transactions
    const summary = await reconciliationService.reconcileTransactions(matches);

    // Return detailed response
    return NextResponse.json({
      success: true,
      summary: {
        totalTransactions: summary.totalTransactions,
        matchedTransactions: summary.matchedTransactions,
        unmatchedTransactions: summary.unmatchedTransactions,
        totalAmount: summary.totalAmount,
        matchedAmount: summary.matchedAmount,
        unmatchedAmount: summary.unmatchedAmount,
        newEntriesCreated: summary.newEntriesCreated,
        entriesReconciled: summary.entriesReconciled,
        lastReconciledDate: summary.lastReconciledDate,
      },
      details: {
        matches: summary.matches.map(match => ({
          bankTransaction: {
            date: match.bankTransaction.date,
            description: match.bankTransaction.description,
            amount: match.bankTransaction.amount,
            balance: match.bankTransaction.balance,
          },
          glEntry: match.glEntry ? {
            date: match.glEntry.date,
            description: match.glEntry.description,
            amount: match.glEntry.amount,
            category: match.glEntry.category,
          } : null,
          confidence: match.confidence,
          matchType: match.matchType,
        })),
      },
    });
  } catch (error: any) {
    logger.error('Bank reconciliation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// OPTIONS method for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}