import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createLogger } from '@targon/logger';
import { getApiBaseUrl } from '@/lib/qbo/client';
import { getValidToken, type QboConnection } from '@/lib/qbo/api';
import type { QboConnectionStatus, QboCompanyInfoResponse } from '@/lib/qbo/types';

const logger = createLogger({ name: 'qbo-status' });

export async function GET() {
  const cookieStore = await cookies();
  const connectionCookie = cookieStore.get('qbo_connection')?.value;

  if (!connectionCookie) {
    return NextResponse.json<QboConnectionStatus>({
      connected: false,
    });
  }

  let connection: QboConnection;
  try {
    connection = JSON.parse(connectionCookie);
  } catch {
    logger.error('Failed to parse QBO connection cookie');
    return NextResponse.json<QboConnectionStatus>({ connected: false });
  }

  // Try to get a valid token (auto-refreshes if expired)
  let accessToken = connection.accessToken;
  try {
    const result = await getValidToken(connection);
    accessToken = result.accessToken;

    // Update cookie if token was refreshed
    if (result.updatedConnection) {
      cookieStore.set('qbo_connection', JSON.stringify(result.updatedConnection), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 100, // 100 days
        path: '/',
      });
      logger.info('QBO token refreshed successfully');
    }
  } catch (refreshError) {
    // Token refresh failed - log but still try with existing token
    logger.warn('Token refresh failed, trying with existing token', {
      error: refreshError instanceof Error ? refreshError.message : String(refreshError),
    });
  }

  // Fetch company info to verify connection and get company name
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(
      `${baseUrl}/v3/company/${connection.realmId}/query?query=select * from CompanyInfo`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );

    if (response.status === 401 || response.status === 403) {
      // Token is truly invalid - user needs to reconnect
      logger.error('QBO authentication failed', { status: response.status });
      return NextResponse.json<QboConnectionStatus>({
        connected: false,
        error: 'Session expired. Please reconnect to QuickBooks.',
      });
    }

    if (!response.ok) {
      // Other error - still connected but couldn't get company info
      logger.error('Failed to fetch company info', { status: response.status });
      return NextResponse.json<QboConnectionStatus>({
        connected: true,
        realmId: connection.realmId,
      });
    }

    const data = (await response.json()) as QboCompanyInfoResponse;
    const companyInfo = data.QueryResponse.CompanyInfo?.[0];

    return NextResponse.json<QboConnectionStatus>({
      connected: true,
      realmId: connection.realmId,
      companyName: companyInfo?.CompanyName,
    });
  } catch (error) {
    // Network error - assume still connected, just can't verify
    logger.error('Failed to verify QBO connection', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json<QboConnectionStatus>({
      connected: true,
      realmId: connection.realmId,
    });
  }
}
