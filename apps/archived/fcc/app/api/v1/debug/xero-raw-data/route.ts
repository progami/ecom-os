import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient, executeXeroAPICall } from '@/lib/xero-helpers';
import { structuredLogger } from '@/lib/logger';

/**
 * Raw Xero Data Debug Endpoint
 * This endpoint shows the complete raw Xero Balance Sheet data
 * in an easy-to-read format for manual analysis
 */
export async function GET(request: NextRequest) {
  try {
    const xeroClient = await getXeroClient();
    if (!xeroClient) {
      return NextResponse.json({ error: 'Xero client not available' }, { status: 500 });
    }

    // Get tenant ID
    const tenantResponse = await executeXeroAPICall<any>(
      xeroClient,
      '',
      (client) => client.accountingApi.getOrganisations()
    );

    const tenantId = tenantResponse?.body?.organisations?.[0]?.organisationID;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'No Xero tenant ID found' }, { status: 500 });
    }

    // Get raw balance sheet
    const balanceSheetResponse = await executeXeroAPICall<any>(
      xeroClient,
      tenantId,
      (client) => client.accountingApi.getReportBalanceSheet(
        tenantId,
        undefined, // date - will use today
        1, // periods
        'MONTH' // timeframe
      )
    );

    const rawReport = balanceSheetResponse?.body?.reports?.[0] || balanceSheetResponse?.reports?.[0];

    if (!rawReport) {
      return NextResponse.json({ error: 'No Balance Sheet data found' }, { status: 404 });
    }

    // Parse into readable format
    const readableData = {
      reportInfo: {
        reportName: rawReport.reportName,
        reportDate: rawReport.reportDate,
        updatedDateUTC: rawReport.updatedDateUTC
      },
      sections: [] as any[]
    };

    // Process each section
    if (rawReport.rows) {
      rawReport.rows.forEach((section: any, sectionIndex: number) => {
        if (section.rowType === 'Section') {
          const sectionData = {
            sectionIndex,
            title: section.title || '',
            rows: [] as any[]
          };

          if (section.rows) {
            section.rows.forEach((row: any, rowIndex: number) => {
              if (row.cells && row.cells.length >= 2) {
                const rowData = {
                  rowIndex,
                  label: row.cells[0]?.value || '',
                  values: row.cells.slice(1).map((cell: any, cellIndex: number) => ({
                    cellIndex: cellIndex + 1,
                    rawValue: cell?.value,
                    numericValue: cell?.value ? parseFloat(cell.value.toString().replace(/,/g, '')) : null
                  }))
                };
                sectionData.rows.push(rowData);
              }
            });
          }

          readableData.sections.push(sectionData);
        }
      });
    }

    // Also provide a flat list of all potential values for key metrics
    const flatList: any[] = [];
    readableData.sections.forEach(section => {
      section.rows.forEach((row: any) => {
        const label = row.label.toLowerCase();
        const lastValue = row.values[row.values.length - 1]?.numericValue || 0;
        
        // Flag rows that might contain our target values
        const flags = [];
        if (label.includes('cash') || label.includes('bank')) flags.push('CASH_CANDIDATE');
        if (label.includes('inventory')) flags.push('INVENTORY_CANDIDATE');
        if (label.includes('assets') && (label.includes('total') || label === 'assets')) flags.push('TOTAL_ASSETS_CANDIDATE');
        if (label.includes('liabilities') && (label.includes('total') || label === 'liabilities')) flags.push('TOTAL_LIABILITIES_CANDIDATE');

        flatList.push({
          section: section.title,
          label: row.label,
          value: lastValue,
          flags,
          allValues: row.values.map((v: any) => v.numericValue)
        });
      });
    });

    // Find exact matches or close matches to expected values
    const expectedValues = {
      totalAssets: 241145.98,
      totalLiabilities: 50439.71,
      cash: 155545.12,
      inventory: 82023.47
    };

    const findMatches = (targetValue: number, tolerance: number = 100) => {
      return flatList.filter(item => 
        item.value !== null && 
        Math.abs(item.value - targetValue) <= tolerance
      ).sort((a, b) => Math.abs(a.value - targetValue) - Math.abs(b.value - targetValue));
    };

    const exactMatches = {
      totalAssets: findMatches(expectedValues.totalAssets),
      totalLiabilities: findMatches(expectedValues.totalLiabilities),
      cash: findMatches(expectedValues.cash),
      inventory: findMatches(expectedValues.inventory)
    };

    return NextResponse.json({
      success: true,
      message: 'Raw Xero Balance Sheet data retrieved successfully',
      reportInfo: readableData.reportInfo,
      expectedValues,
      exactMatches,
      structuredData: readableData,
      flatList: flatList.filter(item => item.flags.length > 0), // Only show flagged candidates
      allData: flatList // Complete flat list
    });

  } catch (error) {
    structuredLogger.error('Raw Xero data debug failed', error, {
      component: 'debug-xero-raw-data'
    });

    return NextResponse.json({
      error: 'Failed to retrieve raw Xero data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}