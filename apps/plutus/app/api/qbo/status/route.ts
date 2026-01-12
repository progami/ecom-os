import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createLogger } from '@targon/logger';
import { getApiBaseUrl } from '@/lib/qbo/client';
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

    const connection = JSON.parse(connectionCookie);
    const { realmId, accessToken, expiresAt } = connection;

    // Check if token is expired
    if (new Date(expiresAt) < new Date()) {
      logger.warn('QBO access token expired');
      return NextResponse.json<QboConnectionStatus>({
        connected: false,
      });
    }

    // Fetch company info to get company name
    const baseUrl = getApiBaseUrl();
    const response = await fetch(
      `${baseUrl}/v3/company/${realmId}/query?query=select * from CompanyInfo`,
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
        realmId,
      });
    }

    const data = (await response.json()) as QboCompanyInfoResponse;
    const companyInfo = data.QueryResponse.CompanyInfo?.[0];

    return NextResponse.json<QboConnectionStatus>({
      connected: true,
      realmId,
      companyName: companyInfo?.CompanyName,
    });
  } catch (error) {
    logger.error('Failed to get QBO status', error);
    return NextResponse.json<QboConnectionStatus>({
      connected: false,
    });
  }
}
