import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getApiBaseUrl, refreshAccessToken } from '@/lib/qbo/client';
import { createLogger } from '@targon/logger';

const logger = createLogger({ name: 'qbo-test-update' });

interface QboConnection {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

async function getValidToken(connection: QboConnection): Promise<{ accessToken: string; connection: QboConnection }> {
  const expiresAt = new Date(connection.expiresAt);
  const now = new Date();

  // If token expires in less than 5 minutes, refresh it
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    logger.info('Access token expired or expiring soon, refreshing...');
    const newTokens = await refreshAccessToken(connection.refreshToken);
    const updatedConnection: QboConnection = {
      ...connection,
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresAt: new Date(Date.now() + newTokens.expiresIn * 1000).toISOString(),
    };
    return { accessToken: newTokens.accessToken, connection: updatedConnection };
  }

  return { accessToken: connection.accessToken, connection };
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const connectionCookie = cookieStore.get('qbo_connection')?.value;

    if (!connectionCookie) {
      return NextResponse.json({ error: 'Not connected to QBO' }, { status: 401 });
    }

    const connection: QboConnection = JSON.parse(connectionCookie);
    const { accessToken } = await getValidToken(connection);
    const baseUrl = getApiBaseUrl();

    // Step 1: Query for recent Purchase transactions (expenses)
    const queryUrl = `${baseUrl}/v3/company/${connection.realmId}/query?query=${encodeURIComponent(
      "SELECT * FROM Purchase WHERE PaymentType = 'Cash' MAXRESULTS 5"
    )}`;

    logger.info('Fetching Purchase transactions...');
    const queryRes = await fetch(queryUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!queryRes.ok) {
      const errorText = await queryRes.text();
      logger.error('Query failed', { status: queryRes.status, error: errorText });
      return NextResponse.json({
        error: 'Failed to query purchases',
        details: errorText,
        step: 'query'
      }, { status: queryRes.status });
    }

    const queryData = await queryRes.json();
    const purchases = queryData.QueryResponse?.Purchase || [];

    if (purchases.length === 0) {
      return NextResponse.json({
        message: 'No Purchase transactions found to test',
        step: 'query',
        suggestion: 'Try querying a different transaction type'
      });
    }

    // Get the first purchase to test
    const testPurchase = purchases[0];

    // Step 2: Try to update DocNumber and PrivateNote
    const updateUrl = `${baseUrl}/v3/company/${connection.realmId}/purchase?operation=update`;

    const originalDocNumber = testPurchase.DocNumber || '(empty)';
    const originalPrivateNote = testPurchase.PrivateNote || '(empty)';

    const testDocNumber = `TEST_${Date.now().toString().slice(-6)}`;
    const testPrivateNote = `Plutus test update at ${new Date().toISOString()}`;

    const updatePayload = {
      Id: testPurchase.Id,
      SyncToken: testPurchase.SyncToken,
      sparse: true,
      DocNumber: testDocNumber,
      PrivateNote: testPrivateNote,
    };

    logger.info('Attempting sparse update...', {
      purchaseId: testPurchase.Id,
      originalDocNumber,
      originalPrivateNote,
      testDocNumber,
      testPrivateNote
    });

    const updateRes = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    const updateData = await updateRes.json();

    if (!updateRes.ok) {
      logger.error('Update failed', { status: updateRes.status, error: updateData });
      return NextResponse.json({
        success: false,
        step: 'update',
        error: updateData,
        message: 'Sparse update FAILED - QBO may not allow updating this transaction type',
        testPurchase: {
          Id: testPurchase.Id,
          TxnDate: testPurchase.TxnDate,
          TotalAmt: testPurchase.TotalAmt,
          PaymentType: testPurchase.PaymentType,
          originalDocNumber,
          originalPrivateNote,
        }
      }, { status: updateRes.status });
    }

    // Step 3: Verify the update worked
    const updatedPurchase = updateData.Purchase;

    const docNumberUpdated = updatedPurchase.DocNumber === testDocNumber;
    const privateNoteUpdated = updatedPurchase.PrivateNote === testPrivateNote;

    // Step 4: Revert to original values
    const revertPayload = {
      Id: updatedPurchase.Id,
      SyncToken: updatedPurchase.SyncToken,
      sparse: true,
      DocNumber: originalDocNumber === '(empty)' ? '' : originalDocNumber,
      PrivateNote: originalPrivateNote === '(empty)' ? '' : originalPrivateNote,
    };

    await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(revertPayload),
    });

    return NextResponse.json({
      success: true,
      message: 'Sparse update test PASSED!',
      results: {
        docNumberCanBeUpdated: docNumberUpdated,
        privateNoteCanBeUpdated: privateNoteUpdated,
      },
      testPurchase: {
        Id: testPurchase.Id,
        TxnDate: testPurchase.TxnDate,
        TotalAmt: testPurchase.TotalAmt,
        PaymentType: testPurchase.PaymentType,
        EntityRef: testPurchase.EntityRef?.name,
      },
      testedValues: {
        originalDocNumber,
        testDocNumber,
        resultDocNumber: updatedPurchase.DocNumber,
        originalPrivateNote,
        testPrivateNote,
        resultPrivateNote: updatedPurchase.PrivateNote,
      },
      conclusion: docNumberUpdated && privateNoteUpdated
        ? 'Both DocNumber (Reference) and PrivateNote (Memo) CAN be updated via API!'
        : 'Some fields could not be updated - check results above',
      reverted: true,
    });

  } catch (error) {
    logger.error('Test update failed', error);
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
