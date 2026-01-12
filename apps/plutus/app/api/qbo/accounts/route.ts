import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchAccounts, type QboConnection } from '@/lib/qbo/api';
import { createLogger } from '@targon/logger';

const logger = createLogger({ name: 'qbo-accounts' });

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
      .map((a) => ({
        id: a.Id,
        name: a.Name,
        type: a.AccountType,
        subType: a.AccountSubType,
        fullyQualifiedName: a.FullyQualifiedName,
        acctNum: a.AcctNum,
        balance: a.CurrentBalance ?? 0,
        currency: a.CurrencyRef?.value ?? 'USD',
        classification: a.Classification,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ accounts: allAccounts, total: allAccounts.length });
  } catch (error) {
    logger.error('Failed to fetch accounts', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
