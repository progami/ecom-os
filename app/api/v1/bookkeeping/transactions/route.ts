import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Implement Xero OAuth2 flow
    // For now, we'll return mock data
    
    // In production, this would:
    // 1. Get Xero access token from user session
    // 2. Fetch transactions from Xero API
    // 3. Apply categorization rules to each transaction
    // 4. Return transactions with suggested categorizations

    // Fetch active rules to apply to transactions
    const rules = await prisma.categorizationRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' }
    });

    // Mock transactions with rule matching
    const mockTransactions = [
      {
        id: 'xero-001',
        date: '2024-01-15',
        description: 'Office Supplies from Staples',
        payee: 'Staples Inc',
        reference: 'INV-2024-001',
        amount: 156.75,
        status: 'AUTHORISED',
        type: 'SPEND',
        // These would be populated by matching rules
        suggestedAccountCode: '400',
        suggestedTaxType: 'INPUT2',
        matchedRule: 'Office Supplies Rule',
        isReconciled: false
      },
      {
        id: 'xero-002',
        date: '2024-01-16',
        description: 'Monthly Software Subscription',
        payee: 'Adobe Systems',
        reference: 'SUB-2024-01',
        amount: 52.99,
        status: 'AUTHORISED',
        type: 'SPEND',
        suggestedAccountCode: '469',
        suggestedTaxType: 'NONE',
        matchedRule: 'Software Subscriptions Rule',
        isReconciled: false
      },
      {
        id: 'xero-003',
        date: '2024-01-17',
        description: 'Client Payment - Project ABC',
        payee: 'ABC Corporation',
        reference: 'PAY-2024-001',
        amount: -5000.00,
        status: 'AUTHORISED',
        type: 'RECEIVE',
        isReconciled: true
      }
    ];

    return NextResponse.json({
      success: true,
      data: mockTransactions,
      count: mockTransactions.length,
      rulesApplied: rules.length
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { transactionId, accountCode, taxType } = body;

    // TODO: In production, this would:
    // 1. Update the transaction in Xero with the confirmed categorization
    // 2. Optionally create a new rule based on this categorization
    // 3. Mark the transaction as reconciled

    return NextResponse.json({
      success: true,
      message: 'Transaction reconciled successfully',
      transactionId,
      accountCode,
      taxType
    });
  } catch (error) {
    console.error('Error reconciling transaction:', error);
    return NextResponse.json(
      { error: 'Failed to reconcile transaction' },
      { status: 500 }
    );
  }
}