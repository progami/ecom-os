import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createLogger } from '@targon/logger';
import type { QboConnection } from '@/lib/qbo/api';
import { ensurePlutusQboLmbPlanAccounts } from '@/lib/qbo/plutus-qbo-lmb-plan';

const logger = createLogger({ name: 'qbo-create-plutus-lmb-accounts' });

export async function POST() {
  try {
    const cookieStore = await cookies();
    const connectionCookie = cookieStore.get('qbo_connection')?.value;

    if (!connectionCookie) {
      return NextResponse.json({ error: 'Not connected to QBO' }, { status: 401 });
    }

    const connection: QboConnection = JSON.parse(connectionCookie);

    const result = await ensurePlutusQboLmbPlanAccounts(connection);

    if (result.updatedConnection) {
      cookieStore.set('qbo_connection', JSON.stringify(result.updatedConnection), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 100,
        path: '/',
      });
    }

    return NextResponse.json({
      created: result.created.map((a) => ({
        id: a.Id,
        name: a.Name,
        fullyQualifiedName: a.FullyQualifiedName,
        accountType: a.AccountType,
        accountSubType: a.AccountSubType,
      })),
      skipped: result.skipped,
    });
  } catch (error) {
    logger.error('Failed to create Plutus LMB plan accounts', error);
    return NextResponse.json(
      { error: 'Failed to create accounts', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

