import { NextRequest, NextResponse } from 'next/server';
import { XeroReportFetcher } from '@/lib/xero-report-fetcher';
import { getXeroClient, executeXeroAPICall } from '@/lib/xero-helpers';
import { structuredLogger } from '@/lib/logger';

/**
 * Balance Sheet Comparison Debug Endpoint
 * This endpoint compares our parsed values with raw Xero data
 * to identify exactly where the discrepancies are occurring
 */
export async function GET(request: NextRequest) {
  try {
    structuredLogger.info('Starting Balance Sheet comparison debug', {
      component: 'debug-balance-sheet-comparison',
      timestamp: new Date().toISOString()
    });

    const xeroClient = await getXeroClient();
    if (!xeroClient) {
      return NextResponse.json({ error: 'Xero client not available' }, { status: 500 });
    }

    // Get tenant ID from Xero
    const tenantResponse = await executeXeroAPICall<any>(
      xeroClient,
      '',
      (client) => client.accountingApi.getOrganisations()
    );

    const tenantId = tenantResponse?.body?.organisations?.[0]?.organisationID;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'No Xero tenant ID found' }, { status: 500 });
    }

    // Get our parsed balance sheet summary for June 30, 2025
    const targetDate = new Date('2025-06-30');
    const ourParsedSummary = await XeroReportFetcher.fetchBalanceSheetSummary(tenantId, targetDate);

    // Get raw Xero response for comparison
    const rawBalanceSheetResponse = await executeXeroAPICall<any>(
      xeroClient,
      tenantId,
      (client) => client.accountingApi.getReportBalanceSheet(
        tenantId,
        '2025-06-30', // June 30, 2025
        3, // periods
        'MONTH' // timeframe
      )
    );

    const rawReport = rawBalanceSheetResponse?.body?.reports?.[0] || rawBalanceSheetResponse?.reports?.[0];

    const expectedValues = {
      totalAssets: 241145.98,
      totalLiabilities: 50439.71,
      netAssets: 190706.27,
      cash: 155545.12,
      inventory: 82023.47
    };

    // Extract all rows from raw report for manual analysis
    const allRawRows: any[] = [];
    if (rawReport && rawReport.rows) {
      rawReport.rows.forEach((section: any, sectionIndex: number) => {
        if (section.rowType === 'Section' && section.rows) {
          const sectionTitle = section.title || '';
          section.rows.forEach((row: any, rowIndex: number) => {
            if (row.cells && row.cells.length >= 2) {
              const label = row.cells[0]?.value || '';
              // Extract all cell values for analysis
              const cellValues = row.cells.map((cell: any, cellIndex: number) => ({
                index: cellIndex,
                value: cell?.value,
                numeric: cell?.value ? parseFloat(cell.value.toString().replace(/,/g, '')) : null
              }));

              allRawRows.push({
                sectionIndex,
                rowIndex,
                sectionTitle,
                label,
                cellValues,
                lastCellValue: cellValues[cellValues.length - 1]?.numeric || 0
              });
            }
          });
        }
      });
    }

    // Find potential matches for each expected value
    const potentialMatches = {
      cash: allRawRows.filter(row => {
        const label = row.label.toLowerCase();
        const section = row.sectionTitle.toLowerCase();
        return (label.includes('cash') || label.includes('bank')) && !label.includes('flow');
      }),
      inventory: allRawRows.filter(row => {
        const label = row.label.toLowerCase();
        return label.includes('inventory');
      }),
      totalAssets: allRawRows.filter(row => {
        const label = row.label.toLowerCase();
        return label.includes('assets') && (label.includes('total') || label === 'assets');
      }),
      totalLiabilities: allRawRows.filter(row => {
        const label = row.label.toLowerCase();
        return label.includes('liabilities') && (label.includes('total') || label === 'liabilities');
      })
    };

    // Find closest matches to expected values
    const findClosestMatch = (candidates: any[], expectedValue: number) => {
      return candidates
        .map(candidate => ({
          ...candidate,
          difference: Math.abs(candidate.lastCellValue - expectedValue),
          percentDiff: expectedValue !== 0 ? Math.abs((candidate.lastCellValue - expectedValue) / expectedValue * 100) : 0
        }))
        .sort((a, b) => a.difference - b.difference);
    };

    const comparison = {
      ourParsedValues: {
        totalAssets: ourParsedSummary.totalAssets,
        totalLiabilities: ourParsedSummary.totalLiabilities,
        netAssets: ourParsedSummary.netAssets,
        cash: ourParsedSummary.cash,
        inventory: ourParsedSummary.inventory
      },
      expectedValues,
      differences: {
        totalAssets: {
          ourValue: ourParsedSummary.totalAssets,
          expected: expectedValues.totalAssets,
          difference: ourParsedSummary.totalAssets - expectedValues.totalAssets,
          percentDiff: ((ourParsedSummary.totalAssets - expectedValues.totalAssets) / expectedValues.totalAssets * 100).toFixed(2) + '%'
        },
        totalLiabilities: {
          ourValue: ourParsedSummary.totalLiabilities,
          expected: expectedValues.totalLiabilities,
          difference: ourParsedSummary.totalLiabilities - expectedValues.totalLiabilities,
          percentDiff: ((ourParsedSummary.totalLiabilities - expectedValues.totalLiabilities) / expectedValues.totalLiabilities * 100).toFixed(2) + '%'
        },
        cash: {
          ourValue: ourParsedSummary.cash,
          expected: expectedValues.cash,
          difference: ourParsedSummary.cash - expectedValues.cash,
          percentDiff: ((ourParsedSummary.cash - expectedValues.cash) / expectedValues.cash * 100).toFixed(2) + '%'
        },
        inventory: {
          ourValue: ourParsedSummary.inventory,
          expected: expectedValues.inventory,
          difference: ourParsedSummary.inventory - expectedValues.inventory,
          percentDiff: ((ourParsedSummary.inventory - expectedValues.inventory) / expectedValues.inventory * 100).toFixed(2) + '%'
        }
      },
      potentialCorrectMatches: {
        cash: findClosestMatch(potentialMatches.cash, expectedValues.cash).slice(0, 5),
        inventory: findClosestMatch(potentialMatches.inventory, expectedValues.inventory).slice(0, 5),
        totalAssets: findClosestMatch(potentialMatches.totalAssets, expectedValues.totalAssets).slice(0, 5),
        totalLiabilities: findClosestMatch(potentialMatches.totalLiabilities, expectedValues.totalLiabilities).slice(0, 5)
      },
      allPotentialMatches: potentialMatches,
      totalRowsAnalyzed: allRawRows.length
    };

    // Log the comprehensive comparison
    structuredLogger.info('BALANCE SHEET COMPARISON ANALYSIS', {
      component: 'debug-balance-sheet-comparison',
      comparison: JSON.stringify(comparison, null, 2)
    });

    // Write detailed comparison to development log
    try {
      const fs = require('fs');
      fs.appendFileSync('development.log', 
        `\n=== BALANCE SHEET COMPARISON ${new Date().toISOString()} ===\n` +
        JSON.stringify(comparison, null, 2) + '\n'
      );
    } catch (logError) {
      structuredLogger.warn('Failed to write comparison to development.log', { error: logError });
    }

    return NextResponse.json({
      success: true,
      message: 'Balance Sheet comparison analysis completed',
      comparison,
      summary: {
        majorDiscrepancies: [
          {
            field: 'Total Assets',
            ourValue: ourParsedSummary.totalAssets,
            expected: expectedValues.totalAssets,
            difference: ourParsedSummary.totalAssets - expectedValues.totalAssets,
            isSignificant: Math.abs(ourParsedSummary.totalAssets - expectedValues.totalAssets) > 1000
          },
          {
            field: 'Total Liabilities',
            ourValue: ourParsedSummary.totalLiabilities,
            expected: expectedValues.totalLiabilities,
            difference: ourParsedSummary.totalLiabilities - expectedValues.totalLiabilities,
            isSignificant: Math.abs(ourParsedSummary.totalLiabilities - expectedValues.totalLiabilities) > 1000
          },
          {
            field: 'Cash',
            ourValue: ourParsedSummary.cash,
            expected: expectedValues.cash,
            difference: ourParsedSummary.cash - expectedValues.cash,
            isSignificant: Math.abs(ourParsedSummary.cash - expectedValues.cash) > 1000
          },
          {
            field: 'Inventory',
            ourValue: ourParsedSummary.inventory,
            expected: expectedValues.inventory,
            difference: ourParsedSummary.inventory - expectedValues.inventory,
            isSignificant: Math.abs(ourParsedSummary.inventory - expectedValues.inventory) > 1000
          }
        ].filter(item => item.isSignificant)
      }
    });

  } catch (error) {
    structuredLogger.error('Balance Sheet comparison debug failed', error, {
      component: 'debug-balance-sheet-comparison'
    });

    return NextResponse.json({
      error: 'Failed to debug Balance Sheet comparison',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}