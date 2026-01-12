import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createLogger } from '@targon/logger';
import { getApiBaseUrl } from '@/lib/qbo/client';
import { getValidToken, type QboConnection } from '@/lib/qbo/api';
import type { QboConnectionStatus, QboCompanyInfoResponse } from '@/lib/qbo/types';

const logger = createLogger({ name: 'qbo-status' });

export async function GET() {
  try {
    const cookieStore = await cookies();
    const connectionCookie = cookieStore.get('qbo_connection')?.value;

    if (!connectionCookie) {
      return NextResponse.json<QboConnectionStatus>({
        connected: false,
      });
    }

    const connection: QboConnection = JSON.parse(connectionCookie);

    // Get valid token (auto-refreshes if expired)
    const { accessToken, updatedConnection } = await getValidToken(connection);

    // Update cookie if token was refreshed
    if (updatedConnection) {
      cookieStore.set('qbo_connection', JSON.stringify(updatedConnection), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 100, // 100 days
        path: '/',
      });
    }

    // Fetch company info to get company name
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

    if (!response.ok) {
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
    logger.error('Failed to get QBO status', error);
    return NextResponse.json<QboConnectionStatus>({
      connected: false,
    });
  }
}
