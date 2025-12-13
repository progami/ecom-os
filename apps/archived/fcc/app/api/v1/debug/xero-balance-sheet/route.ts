import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient, executeXeroAPICall } from '@/lib/xero-helpers';
import { structuredLogger } from '@/lib/logger';

/**
 * Direct Xero Balance Sheet Debug Endpoint
 * This endpoint bypasses all database operations and directly calls Xero API
 * to debug discrepancies in balance sheet values
 */
export async function GET(request: NextRequest) {
  try {
    structuredLogger.info('Starting direct Xero Balance Sheet debug', {
      component: 'debug-xero-balance-sheet',
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

    structuredLogger.info('Retrieved Xero tenant ID', {
      component: 'debug-xero-balance-sheet',
      tenantId
    });

    // Call Xero Balance Sheet API directly for June 30, 2025
    const targetDate = '2025-06-30';
    structuredLogger.info('Fetching Balance Sheet for specific date', {
      component: 'debug-xero-balance-sheet',
      targetDate
    });
    
    const balanceSheetResponse = await executeXeroAPICall<any>(
      xeroClient,
      tenantId,
      (client) => client.accountingApi.getReportBalanceSheet(
        tenantId,
        targetDate, // June 30, 2025
        3, // periods - get multiple to ensure we have the right date
        'MONTH' // timeframe
      )
    );

    const rawResponse = balanceSheetResponse?.body || balanceSheetResponse;
    const report = rawResponse?.reports?.[0];

    // Log the complete raw response
    structuredLogger.info('RAW XERO BALANCE SHEET RESPONSE', {
      component: 'debug-xero-balance-sheet',
      fullResponse: JSON.stringify(rawResponse, null, 2)
    });

    if (!report || !report.rows) {
      return NextResponse.json({
        error: 'No Balance Sheet data found',
        rawResponse
      }, { status: 404 });
    }

    // Initialize debug tracking
    const debugInfo = {
      reportMetadata: {
        reportName: report.reportName,
        reportDate: report.reportDate,
        updatedDateUTC: report.updatedDateUTC,
        totalRows: report.rows?.length || 0
      },
      allRowsFound: [] as any[],
      candidateValues: {
        cash: [] as any[],
        inventory: [] as any[],
        totalAssets: [] as any[],
        totalLiabilities: [] as any[],
        currentAssets: [] as any[],
        currentLiabilities: [] as any[]
      },
      selectedValues: {} as any,
      expectedValues: {
        totalAssets: 241145.98,
        totalLiabilities: 50439.71,
        netAssets: 190706.27,
        cash: 155545.12,
        inventory: 82023.47
      },
      differences: {} as any
    };

    // Find the correct column index for June 30, 2025
    let targetColumnIndex = -1;
    const headerRow = report.rows?.find((row: any) => row.rowType === 'Header');
    if (headerRow && headerRow.cells) {
      structuredLogger.info('Balance Sheet Header Row', {
        component: 'debug-xero-balance-sheet',
        headers: headerRow.cells.map((cell: any) => cell?.value),
        lookingFor: '30 Jun 2025'
      });
      
      // Find column that matches our target date
      headerRow.cells.forEach((cell: any, index: number) => {
        const cellValue = cell?.value || '';
        if (cellValue.includes('30 Jun 2025')) {
          targetColumnIndex = index;
          structuredLogger.info('✅ Found June 30, 2025 column!', {
            component: 'debug-xero-balance-sheet',
            columnIndex: index,
            cellValue
          });
        }
      });
    }
    
    if (targetColumnIndex === -1) {
      structuredLogger.error('❌ Could not find June 30, 2025 column!', {
        component: 'debug-xero-balance-sheet',
        availableHeaders: headerRow?.cells?.map((cell: any) => cell?.value)
      });
      targetColumnIndex = 1; // Default to first data column
    }
    
    // Helper function to extract numeric value from cell using correct date column
    const extractValueFromRow = (row: any): number => {
      if (!row.cells || row.cells.length < 2) return 0;
      
      // Use the target column index (June 30, 2025)
      if (targetColumnIndex < row.cells.length) {
        const value = row.cells[targetColumnIndex]?.value;
        if (value && value !== '') {
          const num = parseFloat(value.toString().replace(/,/g, ''));
          return isNaN(num) ? 0 : num;
        }
      }
      
      return 0;
    };

    // Process all rows in the report
    report.rows.forEach((section: any, sectionIndex: number) => {
      if (section.rowType === 'Section' && section.rows) {
        const sectionTitle = section.title || '';
        
        section.rows.forEach((row: any, rowIndex: number) => {
          if (!row.cells || row.cells.length < 2) return;
          
          const label = row.cells[0]?.value || '';
          const value = extractValueFromRow(row);
          
          // Record ALL rows for complete debugging
          const rowInfo = {
            sectionIndex,
            rowIndex,
            sectionTitle,
            label,
            value,
            cellCount: row.cells.length,
            allCells: row.cells.map((c: any) => c?.value)
          };
          
          debugInfo.allRowsFound.push(rowInfo);

          const labelLower = label.toLowerCase();
          const sectionLower = sectionTitle.toLowerCase();

          // Collect ALL potential candidates for cash
          if (sectionLower.includes('bank') || labelLower.includes('bank') || 
              labelLower.includes('cash')) {
            let priority = 0;
            let reasoning = '';
            
            if (labelLower === 'total bank') {
              priority = 10;
              reasoning = 'Exact match: "total bank"';
            } else if (labelLower.startsWith('total') && sectionLower.includes('bank')) {
              priority = 9;
              reasoning = 'Total in bank section';
            } else if (labelLower.includes('cash at bank') && sectionLower.includes('current assets')) {
              priority = 8;
              reasoning = 'Cash at bank in current assets';
            } else if (labelLower.includes('cash') && !labelLower.includes('flow')) {
              priority = 7;
              reasoning = 'Contains "cash" but not "flow"';
            } else if (labelLower.includes('bank') && !labelLower.includes('loan')) {
              priority = 6;
              reasoning = 'Contains "bank" but not "loan"';
            } else {
              priority = 1;
              reasoning = 'Weak match - contains bank/cash keyword';
            }
            
            if (priority > 0) {
              debugInfo.candidateValues.cash.push({
                ...rowInfo,
                priority,
                reasoning
              });
            }
          }

          // Collect ALL potential candidates for inventory
          if (labelLower.includes('inventory')) {
            let priority = 0;
            let reasoning = '';
            
            if (labelLower === 'total inventory') {
              priority = 10;
              reasoning = 'Exact match: "total inventory"';
            } else if (labelLower.includes('total') && labelLower.includes('inventory')) {
              priority = 9;
              reasoning = 'Contains "total" and "inventory"';
            } else if (labelLower.includes('inventory') && !labelLower.includes('reserve')) {
              priority = 8;
              reasoning = 'Contains "inventory" but not "reserve"';
            } else {
              priority = 1;
              reasoning = 'Contains "inventory"';
            }
            
            if (priority > 0) {
              debugInfo.candidateValues.inventory.push({
                ...rowInfo,
                priority,
                reasoning
              });
            }
          }

          // Collect ALL potential candidates for total assets
          if (labelLower.includes('assets')) {
            let priority = 0;
            let reasoning = '';
            
            if (labelLower === 'total assets' && sectionLower === '') {
              priority = 10;
              reasoning = 'Exact match: "total assets" in root section';
            } else if (labelLower === 'total assets') {
              priority = 9;
              reasoning = 'Exact match: "total assets"';
            } else if (labelLower === 'assets' && sectionLower === '') {
              priority = 8;
              reasoning = 'Match: "assets" in root section';
            } else if (labelLower.includes('total assets') && !labelLower.includes('current') && !labelLower.includes('fixed')) {
              priority = 7;
              reasoning = 'Contains "total assets" (not current/fixed)';
            } else if (labelLower.includes('total') && labelLower.includes('assets')) {
              priority = 6;
              reasoning = 'Contains "total" and "assets"';
            } else {
              priority = 1;
              reasoning = 'Contains "assets"';
            }
            
            if (priority > 0) {
              debugInfo.candidateValues.totalAssets.push({
                ...rowInfo,
                priority,
                reasoning
              });
            }
          }

          // Collect ALL potential candidates for total liabilities
          if (labelLower.includes('liabilities')) {
            let priority = 0;
            let reasoning = '';
            const absValue = Math.abs(value);
            
            if (labelLower === 'total liabilities' && sectionLower === '') {
              priority = 10;
              reasoning = 'Exact match: "total liabilities" in root section';
            } else if (labelLower === 'total liabilities') {
              priority = 9;
              reasoning = 'Exact match: "total liabilities"';
            } else if (labelLower === 'liabilities' && sectionLower === '') {
              priority = 8;
              reasoning = 'Match: "liabilities" in root section';
            } else if (labelLower.includes('total liabilities') && !labelLower.includes('current')) {
              priority = 7;
              reasoning = 'Contains "total liabilities" (not current)';
            } else if (labelLower.includes('total') && labelLower.includes('liabilities')) {
              priority = 6;
              reasoning = 'Contains "total" and "liabilities"';
            } else {
              priority = 1;
              reasoning = 'Contains "liabilities"';
            }
            
            if (priority > 0) {
              debugInfo.candidateValues.totalLiabilities.push({
                ...rowInfo,
                value: absValue, // Store absolute value for liabilities
                priority,
                reasoning
              });
            }
          }

          // Current Assets
          if (sectionLower.includes('current assets') || labelLower.includes('current assets')) {
            if (labelLower === 'total current assets' || 
                (labelLower.includes('total') && sectionLower.includes('current assets'))) {
              debugInfo.candidateValues.currentAssets.push({
                ...rowInfo,
                priority: 10,
                reasoning: 'Total current assets'
              });
            }
          }

          // Current Liabilities
          if (sectionLower.includes('current liabilities') || labelLower.includes('current liabilities')) {
            if (labelLower === 'total current liabilities' || 
                (labelLower.includes('total') && sectionLower.includes('current liabilities'))) {
              debugInfo.candidateValues.currentLiabilities.push({
                ...rowInfo,
                value: Math.abs(value),
                priority: 10,
                reasoning: 'Total current liabilities'
              });
            }
          }
        });
      }
    });

    // Select the best candidates based on priority
    const selectBestCandidate = (candidates: any[]) => {
      if (candidates.length === 0) return null;
      
      // Sort by priority (highest first), then by value (highest first for tie-breaking)
      candidates.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return b.value - a.value;
      });
      
      return candidates[0];
    };

    // Select best values
    debugInfo.selectedValues = {
      cash: selectBestCandidate(debugInfo.candidateValues.cash),
      inventory: selectBestCandidate(debugInfo.candidateValues.inventory),
      totalAssets: selectBestCandidate(debugInfo.candidateValues.totalAssets),
      totalLiabilities: selectBestCandidate(debugInfo.candidateValues.totalLiabilities),
      currentAssets: selectBestCandidate(debugInfo.candidateValues.currentAssets),
      currentLiabilities: selectBestCandidate(debugInfo.candidateValues.currentLiabilities)
    };

    // Calculate differences from expected values
    Object.keys(debugInfo.expectedValues).forEach(key => {
      const expected = debugInfo.expectedValues[key as keyof typeof debugInfo.expectedValues];
      const actual = debugInfo.selectedValues[key]?.value || 0;
      debugInfo.differences[key] = {
        expected,
        actual,
        difference: actual - expected,
        percentageDiff: expected !== 0 ? ((actual - expected) / expected * 100).toFixed(2) + '%' : 'N/A'
      };
    });

    // Log comprehensive debug information
    structuredLogger.info('XERO BALANCE SHEET DEBUG ANALYSIS', {
      component: 'debug-xero-balance-sheet',
      debugInfo: JSON.stringify(debugInfo, null, 2)
    });

    return NextResponse.json({
      success: true,
      message: 'Direct Xero Balance Sheet debug completed',
      debugInfo,
      summary: {
        totalRowsProcessed: debugInfo.allRowsFound.length,
        candidateCounts: {
          cash: debugInfo.candidateValues.cash.length,
          inventory: debugInfo.candidateValues.inventory.length,
          totalAssets: debugInfo.candidateValues.totalAssets.length,
          totalLiabilities: debugInfo.candidateValues.totalLiabilities.length
        },
        selectedValues: Object.fromEntries(
          Object.entries(debugInfo.selectedValues).map(([key, value]) => [
            key, 
            value ? { value: value.value, label: value.label, section: value.sectionTitle } : null
          ])
        ),
        differences: debugInfo.differences
      }
    });

  } catch (error) {
    structuredLogger.error('Debug Xero Balance Sheet failed', error, {
      component: 'debug-xero-balance-sheet'
    });

    return NextResponse.json({
      error: 'Failed to debug Xero Balance Sheet',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}