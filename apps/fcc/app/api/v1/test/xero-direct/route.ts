import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { XeroClient } from 'xero-node';
import { structuredLogger } from '@/lib/logger';

// Direct Xero API test - bypasses all database checks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2025-06-30';
    
    structuredLogger.info('[Xero Direct Test] Starting', { date });

    // Get user with Xero credentials
    const user = await prisma.user.findFirst({
      where: {
        tenantId: { not: null },
        xeroAccessToken: { not: null }
      }
    });

    if (!user || !user.tenantId || !user.xeroAccessToken) {
      return NextResponse.json({
        error: 'No Xero credentials found',
        message: 'Please connect to Xero first'
      }, { status: 400 });
    }

    // Create Xero client
    const xero = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [process.env.XERO_REDIRECT_URI!],
      scopes: process.env.XERO_SCOPES!.split(' ')
    });

    // Set the access token
    xero.setTokenSet({
      access_token: user.xeroAccessToken,
      refresh_token: user.xeroRefreshToken || '',
      expires_at: user.tokenExpiresAt ? Math.floor(user.tokenExpiresAt.getTime() / 1000) : 0,
      token_type: 'Bearer'
    });

    await xero.updateTenants();

    // Fetch balance sheet
    const asAtDate = new Date(date);
    const response = await xero.accountingApi.getReportBalanceSheet(
      user.tenantId,
      asAtDate
    );

    const report = response.body?.reports?.[0];
    if (!report) {
      throw new Error('No balance sheet data returned from Xero');
    }

    // Parse the report - find the June 30 column
    let targetColumnIndex = -1;
    const targetDateStr = asAtDate.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });

    // Find header row
    const headerRow = report.rows?.find((row: any) => row.rowType === 'Header');
    if (headerRow && headerRow.cells) {
      headerRow.cells.forEach((cell: any, index: number) => {
        const cellValue = cell?.value || '';
        if (cellValue.includes(targetDateStr) || cellValue.includes(date)) {
          targetColumnIndex = index;
        }
      });
    }

    // If no specific date column found, use the last column
    if (targetColumnIndex === -1) {
      targetColumnIndex = headerRow?.cells?.length - 1 || 2;
    }

    structuredLogger.info('[Xero Direct Test] Found date column', { 
      targetColumnIndex, 
      targetDateStr,
      headerCells: headerRow?.cells?.map((c: any) => c.value)
    });

    // Extract values
    let totalAssets = 0;
    let totalLiabilities = 0;
    let netAssets = 0;
    let currentAssets = 0;
    let currentLiabilities = 0;
    let cash = 0;

    // Parse the report rows
    report.rows?.forEach((row: any) => {
      if (row.rowType === 'Section' && row.rows) {
        const sectionTitle = row.title || '';
        
        row.rows.forEach((subRow: any) => {
          const rowTitle = subRow.cells?.[0]?.value || '';
          const value = parseFloat(
            subRow.cells?.[targetColumnIndex]?.value?.toString().replace(/[^0-9.-]/g, '') || 0
          );

          // Map values based on row titles
          if (rowTitle.includes('Total Assets')) {
            totalAssets = value;
          } else if (rowTitle.includes('Total Liabilities')) {
            totalLiabilities = value;
          } else if (rowTitle.includes('Net Assets')) {
            netAssets = value;
          } else if (rowTitle.includes('Total Current Assets')) {
            currentAssets = value;
          } else if (rowTitle.includes('Total Current Liabilities')) {
            currentLiabilities = value;
          } else if (rowTitle.includes('Total Bank') || rowTitle.includes('Cash at bank')) {
            cash = value;
          }
        });
      }
    });

    const result = {
      date,
      totalAssets,
      totalLiabilities,
      netAssets,
      currentAssets,
      currentLiabilities,
      cash,
      equity: netAssets, // In a balance sheet, Net Assets = Equity
      source: 'xero_api_direct',
      fetchedAt: new Date().toISOString(),
      columnIndex: targetColumnIndex,
      reportTitle: report.reportName,
      debug: {
        headerRow: headerRow?.cells?.map((c: any) => c.value),
        foundColumn: targetColumnIndex
      }
    };

    structuredLogger.info('[Xero Direct Test] Success', result);

    return NextResponse.json(result);
  } catch (error: any) {
    structuredLogger.error('[Xero Direct Test] Error', error);
    
    return NextResponse.json({
      error: 'Failed to fetch from Xero',
      message: error.message || 'Unknown error',
      details: error.stack
    }, { status: 500 });
  }
}