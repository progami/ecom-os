import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchAccounts, type QboConnection } from '@/lib/qbo/api';
import { createLogger } from '@targon/logger';

const logger = createLogger({ name: 'qbo-accounts' });

// QBO Account Type order (matches QuickBooks Online Chart of Accounts view)
const ACCOUNT_TYPE_ORDER: Record<string, number> = {
  Bank: 1,
  'Accounts Receivable': 2,
  'Other Current Asset': 3,
  'Fixed Asset': 4,
  'Other Asset': 5,
  'Accounts Payable': 6,
  'Credit Card': 7,
  'Other Current Liability': 8,
  'Long Term Liability': 9,
  Equity: 10,
  Income: 11,
  'Other Income': 12,
  'Cost of Goods Sold': 13,
  Expense: 14,
  'Other Expense': 15,
};

export async function GET() {
  try {
    const cookieStore = await cookies();
    const connectionCookie = cookieStore.get('qbo_connection')?.value;

    if (!connectionCookie) {
      return NextResponse.json({ error: 'Not connected to QBO' }, { status: 401 });
    }

    const connection: QboConnection = JSON.parse(connectionCookie);

    const { accounts, updatedConnection } = await fetchAccounts(connection);

    // Update cookie if token was refreshed
    if (updatedConnection) {
      cookieStore.set('qbo_connection', JSON.stringify(updatedConnection), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 100,
        path: '/',
      });
    }

    // Transform all accounts for frontend (matching QBO's Chart of Accounts view)
    const allAccounts = accounts
      .map((a) => {
        // Calculate depth from FullyQualifiedName (count colons)
        const depth = (a.FullyQualifiedName?.split(':').length ?? 1) - 1;
        // Extract parent name from FullyQualifiedName
        const pathParts = a.FullyQualifiedName?.split(':') ?? [a.Name];
        const parentName = pathParts.length > 1 ? pathParts.slice(0, -1).join(':') : null;

        return {
          id: a.Id,
          name: a.Name,
          type: a.AccountType,
          subType: a.AccountSubType,
          fullyQualifiedName: a.FullyQualifiedName,
          acctNum: a.AcctNum,
          balance: a.CurrentBalance ?? 0,
          currency: a.CurrencyRef?.value ?? 'USD',
          classification: a.Classification,
          isSubAccount: a.SubAccount ?? false,
          parentName,
          depth,
        };
      })
      // Sort by Account Type (QBO order), then by FullyQualifiedName within each type
      .sort((a, b) => {
        const typeOrderA = ACCOUNT_TYPE_ORDER[a.type] ?? 99;
        const typeOrderB = ACCOUNT_TYPE_ORDER[b.type] ?? 99;
        if (typeOrderA !== typeOrderB) {
          return typeOrderA - typeOrderB;
        }
        // Within same type, sort by FullyQualifiedName to maintain hierarchy
        return (a.fullyQualifiedName ?? a.name).localeCompare(b.fullyQualifiedName ?? b.name);
      });

    return NextResponse.json({ accounts: allAccounts, total: allAccounts.length });
  } catch (error) {
    logger.error('Failed to fetch accounts', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
