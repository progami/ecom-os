import { getXeroClient, executeXeroAPICall } from './xero-helpers';
import { structuredLogger } from './logger';
import { XeroAccountingApi } from 'xero-node';
import { XeroCashFlowParser } from './parsers/xero-cash-flow-parser';
import { prisma } from './prisma';

interface BalanceSheetSummary {
  totalAssets: number;
  totalLiabilities: number;
  netAssets: number;
  currentAssets: number;
  currentLiabilities: number;
  equity: number;
  cash: number;
  accountsReceivable: number;
  accountsPayable: number;
  inventory: number;
}

interface BalanceSheetAccount {
  accountId?: string;
  accountCode?: string;
  accountName: string;
  accountType?: string;
  balance: number;
}

interface DetailedBalanceSheet {
  assets: {
    currentAssets: BalanceSheetAccount[];
    nonCurrentAssets: BalanceSheetAccount[];
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: BalanceSheetAccount[];
    nonCurrentLiabilities: BalanceSheetAccount[];
    totalLiabilities: number;
  };
  equity: {
    accounts: BalanceSheetAccount[];
    totalEquity: number;
  };
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  netAssets: number;
  currentAssets?: number;
  currentLiabilities?: number;
  nonCurrentAssets?: number;
  nonCurrentLiabilities?: number;
  workingCapital?: number;
  currentRatio?: number;
  quickRatio?: number;
  debtToEquityRatio?: number;
  equityRatio?: number;
  summary?: {
    netAssets: number;
    currentRatio: number;
    quickRatio: number;
    debtToEquityRatio: number;
    equityRatio: number;
  };
  reportDate?: string;
  source: string;
  fetchedAt: string;
}

interface ProfitLossAccount {
  accountId?: string;
  accountCode?: string;
  accountName: string;
  accountType?: string;
  amount: number;
}

interface DetailedProfitLoss {
  revenue: {
    accounts: ProfitLossAccount[];
    totalRevenue: number;
  };
  otherIncome: {
    accounts: ProfitLossAccount[];
    totalOtherIncome: number;
  };
  costOfGoodsSold: {
    accounts: ProfitLossAccount[];
    totalCostOfGoodsSold: number;
  };
  operatingExpenses: {
    accounts: ProfitLossAccount[];
    totalOperatingExpenses: number;
  };
  otherExpenses: {
    accounts: ProfitLossAccount[];
    totalOtherExpenses: number;
  };
  totalRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  // Summary values - renamed to avoid conflicts
  totalOperatingExpenses: number;
  totalOtherIncome: number;
  totalOtherExpenses: number;
  periodStart?: string;
  periodEnd?: string;
  source: string;
  fetchedAt: string;
}

interface ProfitLossSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  grossProfit: number;
  operatingExpenses: number;
  otherIncome: number;
  otherExpenses: number;
}

interface TrialBalanceSummary {
  accounts: Array<{
    accountId: string;
    accountName: string;
    accountCode: string;
    accountType: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  totalDebits: number;
  totalCredits: number;
}

interface CashFlowSummary {
  cashAtStart: number;
  cashAtEnd: number;
  netCashFlow: number;
  operatingActivities: number;
  investingActivities: number;
  financingActivities: number;
  period: string;
  periodStart: string;
  periodEnd: string;
}

interface AgedReceivablesSummary {
  totalOutstanding: number;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days91Plus: number;
  contacts: Array<{
    contactId: string;
    contactName: string;
    totalOutstanding: number;
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    days91Plus: number;
  }>;
}

interface AgedPayablesSummary {
  totalOutstanding: number;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days91Plus: number;
  contacts: Array<{
    contactId: string;
    contactName: string;
    totalOutstanding: number;
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    days91Plus: number;
  }>;
}


/**
 * Optimized report fetching using Xero's newer endpoints and direct data access
 */
export class XeroReportFetcher {
  /**
   * Fetch Balance Sheet summary using accounts endpoint
   * More efficient than parsing the report endpoint
   */
  static async fetchBalanceSheetSummary(tenantId: string, asAtDate?: Date): Promise<BalanceSheetSummary> {
    try {
      const xeroClient = await getXeroClient();
      if (!xeroClient) {
        throw new Error('Xero client not available');
      }
      
      // Use June 30, 2025 as the target date if not specified
      const targetDate = asAtDate || new Date('2025-06-30');
      
      structuredLogger.info('Fetching Balance Sheet for specific date', {
        component: 'xero-report-fetcher',
        targetDate: targetDate.toISOString().split('T')[0],
        requestedDate: asAtDate?.toISOString().split('T')[0] || 'default to 2025-06-30'
      });
      
      // Fetch the actual Balance Sheet report
      const balanceSheetResponse = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => client.accountingApi.getReportBalanceSheet(
          tenantId,
          targetDate.toISOString().split('T')[0], // date in YYYY-MM-DD format
          3, // periods - get multiple periods to find the right date
          'MONTH' // timeframe
        )
      );
      
      const report = balanceSheetResponse?.body?.reports?.[0] || balanceSheetResponse?.reports?.[0];
      
      structuredLogger.debug('Fetched Balance Sheet from Xero', {
        component: 'xero-report-fetcher',
        hasReport: !!report,
        reportName: report?.reportName,
        rowCount: report?.rows?.length || 0
      });
      
      // Initialize summary
      const summary: BalanceSheetSummary = {
        totalAssets: 0,
        totalLiabilities: 0,
        netAssets: 0,
        currentAssets: 0,
        currentLiabilities: 0,
        equity: 0,
        cash: 0,
        accountsReceivable: 0,
        accountsPayable: 0,
        inventory: 0
      };
      
      if (!report || !report.rows) {
        structuredLogger.warn('No Balance Sheet data found', {
          component: 'xero-report-fetcher'
        });
        return summary;
      }
      
      // Log entire report structure for debugging
      structuredLogger.info('XERO BALANCE SHEET RAW REPORT', {
        component: 'xero-report-fetcher',
        reportStructure: JSON.stringify(report, null, 2)
      });
      
      // Write raw report to development log for detailed analysis
      const fs = require('fs');
      try {
        const logData = {
          timestamp: new Date().toISOString(),
          reportName: report.reportName,
          reportDate: report.reportDate,
          fullReport: report
        };
        fs.appendFileSync('development.log', 
          `\n=== XERO BALANCE SHEET RAW DUMP ${new Date().toISOString()} ===\n` +
          JSON.stringify(logData, null, 2) + '\n'
        );
      } catch (logError) {
        structuredLogger.warn('Failed to write to development.log', { error: logError });
      }
      
      // Find the correct column index for our target date
      let targetColumnIndex = -1;
      const targetDateStr = targetDate.toISOString().split('T')[0];
      
      // Find header row to identify date columns
      const headerRow = report.rows?.find((row: any) => row.rowType === 'Header');
      if (headerRow && headerRow.cells) {
        structuredLogger.info('Balance Sheet Header Row Analysis', {
          component: 'xero-report-fetcher',
          headers: headerRow.cells.map((cell: any) => cell?.value),
          targetDate: targetDateStr,
          lookingFor: '30 Jun 2025'
        });
        
        // Find column that matches our target date
        headerRow.cells.forEach((cell: any, index: number) => {
          const cellValue = cell?.value || '';
          // Check for "30 Jun 2025" specifically
          if (cellValue.includes('30 Jun 2025')) {
            targetColumnIndex = index;
            structuredLogger.info('✅ Found June 30, 2025 column!', {
              component: 'xero-report-fetcher',
              columnIndex: index,
              cellValue,
              targetDate: targetDateStr
            });
          }
        });
      }
      
      // If we couldn't find the target date column, log error
      if (targetColumnIndex === -1) {
        structuredLogger.error('❌ Could not find June 30, 2025 column!', {
          component: 'xero-report-fetcher',
          targetDate: targetDateStr,
          availableHeaders: headerRow?.cells?.map((cell: any) => cell?.value),
          defaultingToColumn: 1
        });
        targetColumnIndex = 1; // Default to first data column
      }
      
      // Helper function to extract value from row using the correct column
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
      
      // Temporary storage for all found values for debugging and candidate selection
      const foundValues: { [key: string]: { value: number, section: string, row: string } } = {};
      const allCandidates: { [key: string]: Array<{ value: number, section: string, row: string, priority: number }> } = {
        cash: [],
        inventory: [],
        totalAssets: [],
        totalLiabilities: [],
        currentAssets: [],
        currentLiabilities: []
      };
      
      // Process report sections
      report.rows.forEach((section: any, sectionIndex: number) => {
        if (section.rowType === 'Section' && section.rows) {
          const sectionTitle = section.title || '';
          
          structuredLogger.debug(`Processing Section ${sectionIndex}: ${sectionTitle}`, {
            component: 'xero-report-fetcher',
            sectionTitle,
            rowCount: section.rows?.length || 0
          });
          
          section.rows.forEach((row: any, rowIndex: number) => {
            if (!row.cells || row.cells.length < 2) return;
            
            const label = row.cells[0]?.value || '';
            const value = extractValueFromRow(row);
            
            // Log every row for debugging
            structuredLogger.info(`ROW ANALYSIS ${sectionIndex}.${rowIndex}`, {
              component: 'xero-report-fetcher',
              section: sectionTitle,
              label,
              value,
              cellCount: row.cells.length,
              cells: row.cells.map((c: any) => c?.value),
              rawCells: row.cells
            });
            
            // Write detailed row analysis to development log
            try {
              const fs = require('fs');
              fs.appendFileSync('development.log', 
                `ROW ${sectionIndex}.${rowIndex}: Section="${sectionTitle}" Label="${label}" Value=${value} Cells=[${row.cells.map((c: any) => c?.value).join(', ')}]\n`
              );
            } catch (logError) {
              // Silent fail
            }
            
            const labelLower = label.toLowerCase();
            const sectionLower = sectionTitle.toLowerCase();
            
            // Bank/Cash - collect all candidates with priorities
            if (sectionLower.includes('bank') || labelLower.includes('bank') || 
                labelLower.includes('cash')) {
              let priority = 0;
              
              if (labelLower === 'total bank') priority = 10; // Highest priority
              else if (labelLower.startsWith('total') && sectionLower.includes('bank')) priority = 9;
              else if (labelLower.includes('cash at bank') && sectionLower.includes('current assets')) priority = 8;
              else if (labelLower.includes('cash') && !labelLower.includes('flow')) priority = 7;
              else if (labelLower.includes('bank') && !labelLower.includes('loan')) priority = 6;
              
              if (priority > 0) {
                allCandidates.cash.push({ value, section: sectionTitle, row: label, priority });
                structuredLogger.info(`CASH CANDIDATE FOUND`, {
                  component: 'xero-report-fetcher',
                  priority,
                  value,
                  section: sectionTitle,
                  row: label,
                  reasoning: priority === 10 ? 'Total bank (highest priority)' : 
                            priority === 9 ? 'Total in bank section' :
                            priority === 8 ? 'Cash at bank in current assets' :
                            priority === 7 ? 'Contains cash (not flow)' :
                            priority === 6 ? 'Contains bank (not loan)' : 'Other match'
                });
              }
            }
            
            // Inventory - collect all candidates with priorities
            if (labelLower.includes('inventory')) {
              let priority = 0;
              
              if (labelLower === 'total inventory') priority = 10; // Highest priority
              else if (labelLower.includes('total') && labelLower.includes('inventory')) priority = 9;
              else if (labelLower.includes('inventory') && !labelLower.includes('reserve')) priority = 8;
              
              if (priority > 0) {
                allCandidates.inventory.push({ value, section: sectionTitle, row: label, priority });
                structuredLogger.info(`INVENTORY CANDIDATE FOUND`, {
                  component: 'xero-report-fetcher',
                  priority,
                  value,
                  section: sectionTitle,
                  row: label,
                  reasoning: priority === 10 ? 'Total inventory (highest priority)' : 
                            priority === 9 ? 'Contains total and inventory' :
                            priority === 8 ? 'Inventory (not reserve)' : 'Other inventory match'
                });
              }
            }
            
            // Current Assets
            if (sectionLower.includes('current assets') || labelLower.includes('current assets')) {
              if (labelLower.includes('accounts receivable') && !labelLower.includes('total')) {
                foundValues['accountsReceivable'] = { value, section: sectionTitle, row: label };
                summary.accountsReceivable = value;
              } else if (labelLower === 'total current assets' || 
                        (labelLower.includes('total') && sectionLower.includes('current assets'))) {
                foundValues['currentAssets'] = { value, section: sectionTitle, row: label };
                summary.currentAssets = value;
                structuredLogger.info('Found Current Assets value', {
                  component: 'xero-report-fetcher',
                  currentAssets: value,
                  section: sectionTitle,
                  row: label
                });
              }
            }
            
            // Current Liabilities
            if (sectionLower.includes('current liabilities') || labelLower.includes('current liabilities')) {
              if (labelLower.includes('accounts payable') && !labelLower.includes('total')) {
                foundValues['accountsPayable'] = { value: Math.abs(value), section: sectionTitle, row: label };
                summary.accountsPayable = Math.abs(value);
              } else if (labelLower === 'total current liabilities' || 
                        (labelLower.includes('total') && sectionLower.includes('current liabilities'))) {
                foundValues['currentLiabilities'] = { value: Math.abs(value), section: sectionTitle, row: label };
                summary.currentLiabilities = Math.abs(value);
                structuredLogger.info('Found Current Liabilities value', {
                  component: 'xero-report-fetcher',
                  currentLiabilities: Math.abs(value),
                  section: sectionTitle,
                  row: label
                });
              }
            }
            
            // Total Assets - collect all candidates with priorities
            if ((labelLower.includes('assets') || labelLower.includes('total')) &&
                labelLower.includes('assets')) {
              let priority = 0;
              
              if (labelLower === 'total assets' && sectionLower === '') priority = 10; // Highest: final summary
              else if (labelLower === 'total assets') priority = 9;
              else if (labelLower === 'assets' && sectionLower === '') priority = 8;
              else if (labelLower.includes('total assets') && !labelLower.includes('current') && !labelLower.includes('fixed')) priority = 7;
              
              if (priority > 0) {
                allCandidates.totalAssets.push({ value, section: sectionTitle, row: label, priority });
                structuredLogger.info(`TOTAL ASSETS CANDIDATE FOUND`, {
                  component: 'xero-report-fetcher',
                  priority,
                  value,
                  section: sectionTitle,
                  row: label,
                  reasoning: priority === 10 ? 'Total assets in root section (highest priority)' : 
                            priority === 9 ? 'Total assets exact match' :
                            priority === 8 ? 'Assets in root section' :
                            priority === 7 ? 'Total assets (not current/fixed)' : 'Other assets match'
                });
              }
            }
            
            // Total Liabilities - collect all candidates with priorities
            if ((labelLower.includes('liabilities') || labelLower.includes('total')) &&
                labelLower.includes('liabilities')) {
              let priority = 0;
              const absValue = Math.abs(value);
              
              if (labelLower === 'total liabilities' && sectionLower === '') priority = 10; // Highest: final summary
              else if (labelLower === 'total liabilities') priority = 9;
              else if (labelLower === 'liabilities' && sectionLower === '') priority = 8;
              else if (labelLower.includes('total liabilities') && !labelLower.includes('current')) priority = 7;
              
              if (priority > 0) {
                allCandidates.totalLiabilities.push({ value: absValue, section: sectionTitle, row: label, priority });
                structuredLogger.info(`TOTAL LIABILITIES CANDIDATE FOUND`, {
                  component: 'xero-report-fetcher',
                  priority,
                  value: absValue,
                  originalValue: value,
                  section: sectionTitle,
                  row: label,
                  reasoning: priority === 10 ? 'Total liabilities in root section (highest priority)' : 
                            priority === 9 ? 'Total liabilities exact match' :
                            priority === 8 ? 'Liabilities in root section' :
                            priority === 7 ? 'Total liabilities (not current)' : 'Other liabilities match'
                });
              }
            }
            
            // Equity
            if (labelLower === 'total equity' || 
                (labelLower === 'equity' && sectionLower === '') ||
                labelLower.includes('total equity')) {
              foundValues['equity'] = { value, section: sectionTitle, row: label };
              summary.equity = value;
              structuredLogger.info('Found Equity value', {
                component: 'xero-report-fetcher',
                equity: value,
                section: sectionTitle,
                row: label
              });
            }
          });
        }
      });
      
      // Select the best candidates based on priority
      const selectBestCandidate = (candidates: Array<{ value: number, section: string, row: string, priority: number }>) => {
        if (candidates.length === 0) return null;
        
        // Sort by priority (highest first), then by value (highest first for tie-breaking)
        candidates.sort((a, b) => {
          if (a.priority !== b.priority) return b.priority - a.priority;
          return b.value - a.value;
        });
        
        return candidates[0];
      };
      
      // Apply best candidates to summary
      const bestCash = selectBestCandidate(allCandidates.cash);
      if (bestCash) {
        summary.cash = bestCash.value;
        foundValues['cash'] = bestCash;
        structuredLogger.info('Selected best Cash candidate', {
          component: 'xero-report-fetcher',
          selected: bestCash,
          totalCandidates: allCandidates.cash.length
        });
      }
      
      const bestInventory = selectBestCandidate(allCandidates.inventory);
      if (bestInventory) {
        summary.inventory = bestInventory.value;
        foundValues['inventory'] = bestInventory;
        structuredLogger.info('Selected best Inventory candidate', {
          component: 'xero-report-fetcher',
          selected: bestInventory,
          totalCandidates: allCandidates.inventory.length
        });
      }
      
      const bestTotalAssets = selectBestCandidate(allCandidates.totalAssets);
      if (bestTotalAssets) {
        summary.totalAssets = bestTotalAssets.value;
        foundValues['totalAssets'] = bestTotalAssets;
        structuredLogger.info('Selected best Total Assets candidate', {
          component: 'xero-report-fetcher',
          selected: bestTotalAssets,
          totalCandidates: allCandidates.totalAssets.length
        });
      }
      
      const bestTotalLiabilities = selectBestCandidate(allCandidates.totalLiabilities);
      if (bestTotalLiabilities) {
        summary.totalLiabilities = bestTotalLiabilities.value;
        foundValues['totalLiabilities'] = bestTotalLiabilities;
        structuredLogger.info('Selected best Total Liabilities candidate', {
          component: 'xero-report-fetcher',
          selected: bestTotalLiabilities,
          totalCandidates: allCandidates.totalLiabilities.length
        });
      }
      
      // Log all candidates for debugging with extensive detail
      structuredLogger.info('ALL BALANCE SHEET CANDIDATES SUMMARY', {
        component: 'xero-report-fetcher',
        candidatesSummary: {
          cash: {
            count: allCandidates.cash.length,
            candidates: allCandidates.cash.map(c => ({
              value: c.value,
              priority: c.priority,
              section: c.section,
              row: c.row
            }))
          },
          inventory: {
            count: allCandidates.inventory.length,
            candidates: allCandidates.inventory.map(c => ({
              value: c.value,
              priority: c.priority,
              section: c.section,
              row: c.row
            }))
          },
          totalAssets: {
            count: allCandidates.totalAssets.length,
            candidates: allCandidates.totalAssets.map(c => ({
              value: c.value,
              priority: c.priority,
              section: c.section,
              row: c.row
            }))
          },
          totalLiabilities: {
            count: allCandidates.totalLiabilities.length,
            candidates: allCandidates.totalLiabilities.map(c => ({
              value: c.value,
              priority: c.priority,
              section: c.section,
              row: c.row
            }))
          }
        }
      });
      
      // Write candidates summary to development log
      try {
        const fs = require('fs');
        fs.appendFileSync('development.log', 
          `\n=== CANDIDATES SUMMARY ===\n` +
          JSON.stringify({
            cash: allCandidates.cash,
            inventory: allCandidates.inventory,
            totalAssets: allCandidates.totalAssets,
            totalLiabilities: allCandidates.totalLiabilities
          }, null, 2) + '\n'
        );
      } catch (logError) {
        // Silent fail
      }
      
      // Calculate net assets if not found
      if (summary.netAssets === 0 && summary.totalAssets > 0) {
        summary.netAssets = summary.totalAssets - summary.totalLiabilities;
      }
      
      // Log comprehensive final summary with all details
      structuredLogger.info('FINAL BALANCE SHEET PARSING SUMMARY', {
        component: 'xero-report-fetcher',
        selectedValues: {
          cash: bestCash ? { value: bestCash.value, section: bestCash.section, row: bestCash.row, priority: bestCash.priority } : null,
          inventory: bestInventory ? { value: bestInventory.value, section: bestInventory.section, row: bestInventory.row, priority: bestInventory.priority } : null,
          totalAssets: bestTotalAssets ? { value: bestTotalAssets.value, section: bestTotalAssets.section, row: bestTotalAssets.row, priority: bestTotalAssets.priority } : null,
          totalLiabilities: bestTotalLiabilities ? { value: bestTotalLiabilities.value, section: bestTotalLiabilities.section, row: bestTotalLiabilities.row, priority: bestTotalLiabilities.priority } : null
        },
        finalSummary: summary,
        expectedVsActual: {
          cash: { 
            expected: 155545.12, 
            actual: summary.cash, 
            diff: summary.cash - 155545.12,
            percentDiff: summary.cash > 0 ? ((summary.cash - 155545.12) / 155545.12 * 100).toFixed(2) + '%' : 'N/A'
          },
          inventory: { 
            expected: 82023.47, 
            actual: summary.inventory, 
            diff: summary.inventory - 82023.47,
            percentDiff: summary.inventory > 0 ? ((summary.inventory - 82023.47) / 82023.47 * 100).toFixed(2) + '%' : 'N/A'
          },
          totalAssets: { 
            expected: 241145.98, 
            actual: summary.totalAssets, 
            diff: summary.totalAssets - 241145.98,
            percentDiff: summary.totalAssets > 0 ? ((summary.totalAssets - 241145.98) / 241145.98 * 100).toFixed(2) + '%' : 'N/A'
          },
          totalLiabilities: { 
            expected: 50439.71, 
            actual: summary.totalLiabilities, 
            diff: summary.totalLiabilities - 50439.71,
            percentDiff: summary.totalLiabilities > 0 ? ((summary.totalLiabilities - 50439.71) / 50439.71 * 100).toFixed(2) + '%' : 'N/A'
          }
        }
      });
      
      // Write final summary to development log
      try {
        const fs = require('fs');
        fs.appendFileSync('development.log', 
          `\n=== FINAL PARSING RESULTS ===\n` +
          `Expected vs Actual:\n` +
          `Cash: Expected £155,545.12, Got £${summary.cash.toFixed(2)}, Diff: £${(summary.cash - 155545.12).toFixed(2)}\n` +
          `Inventory: Expected £82,023.47, Got £${summary.inventory.toFixed(2)}, Diff: £${(summary.inventory - 82023.47).toFixed(2)}\n` +
          `Total Assets: Expected £241,145.98, Got £${summary.totalAssets.toFixed(2)}, Diff: £${(summary.totalAssets - 241145.98).toFixed(2)}\n` +
          `Total Liabilities: Expected £50,439.71, Got £${summary.totalLiabilities.toFixed(2)}, Diff: £${(summary.totalLiabilities - 50439.71).toFixed(2)}\n`
        );
      } catch (logError) {
        // Silent fail
      }
      
      structuredLogger.info('Balance sheet summary calculated', {
        component: 'xero-report-fetcher',
        tenantId,
        summary,
        sectionsProcessed: report.rows?.length || 0
      });
      
      return summary;
    } catch (error) {
      structuredLogger.error('Failed to fetch balance sheet summary', error, {
        component: 'xero-report-fetcher',
        tenantId
      });
      throw error;
    }
  }
  
  /**
   * Fetch Profit & Loss summary using newer endpoint
   */
  static async fetchProfitLossSummary(
    tenantId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<ProfitLossSummary> {
    try {
      const xeroClient = await getXeroClient();
      if (!xeroClient) {
        throw new Error('Xero client not available');
      }
      
      structuredLogger.info('Fetching P&L report from Xero', {
        component: 'xero-report-fetcher',
        fromDate: fromDate?.toISOString().split('T')[0],
        toDate: toDate?.toISOString().split('T')[0]
      });
      
      // Use the profit and loss endpoint with date parameters
      const response = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => client.accountingApi.getReportProfitAndLoss(
          tenantId,
          fromDate?.toISOString().split('T')[0], // Format as YYYY-MM-DD
          toDate?.toISOString().split('T')[0],   // Format as YYYY-MM-DD
          undefined, // periods
          undefined, // timeframe
          undefined, // trackingCategoryID
          undefined, // trackingCategoryID2
          undefined, // trackingOptionID
          undefined, // trackingOptionID2
          true, // standardLayout
          false // paymentsOnly
        )
      );
      
      const report = response?.body?.reports?.[0] || response?.reports?.[0];
      
      structuredLogger.debug('Fetched P&L from Xero', {
        component: 'xero-report-fetcher',
        hasReport: !!report,
        reportName: report?.reportName,
        reportTitle: report?.reportTitle,
        rowCount: report?.rows?.length || 0
      });
      
      // Initialize summary
      const summary: ProfitLossSummary = {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        grossProfit: 0,
        operatingExpenses: 0,
        otherIncome: 0,
        otherExpenses: 0
      };
      
      if (!report || !report.rows) {
        structuredLogger.warn('No P&L data found', {
          component: 'xero-report-fetcher',
          response: JSON.stringify(response)
        });
        return summary;
      }
      
      // Log entire report structure for debugging
      structuredLogger.info('XERO P&L RAW REPORT', {
        component: 'xero-report-fetcher',
        reportStructure: JSON.stringify(report, null, 2)
      });
      
      // Write raw report to development log for detailed analysis
      const fs = require('fs');
      try {
        const logData = {
          timestamp: new Date().toISOString(),
          reportName: report.reportName,
          reportTitle: report.reportTitle,
          reportDate: report.reportDate,
          fromDate: fromDate?.toISOString().split('T')[0],
          toDate: toDate?.toISOString().split('T')[0],
          fullReport: report
        };
        fs.appendFileSync('development.log', 
          `\n=== XERO P&L RAW DUMP ${new Date().toISOString()} ===\n` +
          JSON.stringify(logData, null, 2) + '\n'
        );
      } catch (logError) {
        structuredLogger.warn('Failed to write to development.log', { error: logError });
      }
      
      // Find the correct column index for values
      let valueColumnIndex = 1; // Default to second column
      
      // Check if there's a header row to understand column structure
      const headerRow = report.rows?.find((row: any) => row.rowType === 'Header');
      if (headerRow && headerRow.cells) {
        structuredLogger.info('P&L Header Row Analysis', {
          component: 'xero-report-fetcher',
          headers: headerRow.cells.map((cell: any) => cell?.value),
          cellCount: headerRow.cells.length
        });
        
        // Usually the value is in the second column (index 1) after the account name
        // but let's verify
        if (headerRow.cells.length >= 2) {
          valueColumnIndex = 1;
        }
      }
      
      // Helper function to extract value from row
      const extractValueFromRow = (row: any): number => {
        if (!row.cells || row.cells.length <= valueColumnIndex) return 0;
        
        const value = row.cells[valueColumnIndex]?.value;
        if (value !== undefined && value !== null && value !== '') {
          const valueStr = value.toString();
          // Check if value is in parentheses (negative)
          const isNegative = valueStr.includes('(') && valueStr.includes(')');
          // Remove currency symbols, commas, and parentheses
          const cleanValue = valueStr.replace(/[$£€,()]/g, '').trim();
          const num = parseFloat(cleanValue);
          if (isNaN(num)) return 0;
          // Apply negative sign if value was in parentheses
          return isNegative ? -num : num;
        }
        return 0;
      };
      
      // Track all found values for debugging
      const foundValues: { [key: string]: { value: number, section: string, row: string } } = {};
      let incomeTotal = 0;
      let expenseTotal = 0;
      let costOfSalesTotal = 0;
      
      // Process report sections
      report.rows.forEach((section: any, sectionIndex: number) => {
        if (section.rowType === 'Section' && section.rows) {
          const sectionTitle = section.title || '';
          const sectionLower = sectionTitle.toLowerCase();
          
          structuredLogger.info(`Processing P&L Section ${sectionIndex}: ${sectionTitle}`, {
            component: 'xero-report-fetcher',
            sectionTitle,
            rowCount: section.rows?.length || 0
          });
          
          // Track section totals
          let sectionTotal = 0;
          let isIncomeSection = false;
          let isExpenseSection = false;
          let isCostOfSalesSection = false;
          
          // Determine section type
          if (sectionLower.includes('income') || sectionLower.includes('revenue') || 
              sectionLower.includes('sales') || sectionTitle === 'Trading Income') {
            isIncomeSection = true;
          } else if (sectionLower.includes('expense') || sectionLower.includes('cost') ||
                     sectionTitle === 'Operating Expenses') {
            isExpenseSection = true;
            if (sectionLower.includes('cost of sales') || sectionLower.includes('cost of goods')) {
              isCostOfSalesSection = true;
            }
          }
          
          section.rows.forEach((row: any, rowIndex: number) => {
            if (!row.cells || row.cells.length < 2) return;
            
            const label = row.cells[0]?.value || '';
            const value = extractValueFromRow(row);
            const labelLower = label.toLowerCase();
            
            // Log every row for debugging
            structuredLogger.info(`P&L ROW ANALYSIS ${sectionIndex}.${rowIndex}`, {
              component: 'xero-report-fetcher',
              section: sectionTitle,
              label,
              value,
              cellCount: row.cells.length,
              cells: row.cells.map((c: any) => c?.value),
              rawValue: row.cells[valueColumnIndex]?.value
            });
            
            // Write detailed row analysis to development log
            try {
              fs.appendFileSync('development.log', 
                `P&L ROW ${sectionIndex}.${rowIndex}: Section="${sectionTitle}" Label="${label}" Value=${value} Cells=[${row.cells.map((c: any) => c?.value).join(', ')}]\n`
              );
            } catch (logError) {
              // Silent fail
            }
            
            // Skip truly empty rows (but allow zero values)
            if (!label) {
              return;
            }
            
            // Track individual line items
            if (isIncomeSection && !labelLower.includes('total')) {
              incomeTotal += Math.abs(value); // Income values might be negative in some formats
              structuredLogger.info('Added to income total', {
                component: 'xero-report-fetcher',
                label,
                value: Math.abs(value),
                runningTotal: incomeTotal
              });
            } else if (isExpenseSection && !labelLower.includes('total')) {
              const expenseValue = Math.abs(value);
              expenseTotal += expenseValue;
              
              if (isCostOfSalesSection) {
                costOfSalesTotal += expenseValue;
              }
              
              structuredLogger.info('Added to expense total', {
                component: 'xero-report-fetcher',
                label,
                value: expenseValue,
                runningExpenseTotal: expenseTotal,
                isCostOfSales: isCostOfSalesSection
              });
            }
            
            // Look for section totals
            if (labelLower.includes('total')) {
              const totalValue = Math.abs(value);
              
              if (isIncomeSection) {
                foundValues['sectionIncomeTotal'] = { value: totalValue, section: sectionTitle, row: label };
                summary.totalRevenue = Math.max(summary.totalRevenue, totalValue);
                structuredLogger.info('Found Income Section Total', {
                  component: 'xero-report-fetcher',
                  section: sectionTitle,
                  total: totalValue
                });
              } else if (isExpenseSection) {
                foundValues['sectionExpenseTotal'] = { value: totalValue, section: sectionTitle, row: label };
                if (isCostOfSalesSection) {
                  summary.operatingExpenses = totalValue;
                } else {
                  summary.totalExpenses = Math.max(summary.totalExpenses, totalValue);
                }
                structuredLogger.info('Found Expense Section Total', {
                  component: 'xero-report-fetcher',
                  section: sectionTitle,
                  total: totalValue,
                  isCostOfSales: isCostOfSalesSection
                });
              }
            }
            
            // Look for specific profit/summary lines
            if (labelLower === 'gross profit' || labelLower === 'gross margin') {
              summary.grossProfit = value;
              foundValues['grossProfit'] = { value, section: sectionTitle, row: label };
            } else if (labelLower === 'net profit' || labelLower === 'net income' || 
                      labelLower === 'net earnings' || labelLower === 'profit for the year' ||
                      labelLower === 'profit/(loss) for the year') {
              summary.netProfit = value;
              foundValues['netProfit'] = { value, section: sectionTitle, row: label };
            } else if (labelLower === 'operating profit' || labelLower === 'operating income') {
              foundValues['operatingProfit'] = { value, section: sectionTitle, row: label };
            }
          });
        } else if (section.rowType === 'Row' && section.cells) {
          // Handle root-level rows (like final totals)
          const label = section.cells[0]?.value || '';
          const value = extractValueFromRow(section);
          const labelLower = label.toLowerCase();
          
          structuredLogger.info('P&L ROOT ROW', {
            component: 'xero-report-fetcher',
            label,
            value,
            cells: section.cells.map((c: any) => c?.value)
          });
          
          if (labelLower.includes('net profit') || labelLower.includes('net income') ||
              labelLower.includes('profit/(loss)')) {
            summary.netProfit = value;
            foundValues['finalNetProfit'] = { value, section: 'Root', row: label };
          }
        }
      });
      
      // If we didn't find section totals, use accumulated totals
      if (summary.totalRevenue === 0 && incomeTotal > 0) {
        summary.totalRevenue = incomeTotal;
        structuredLogger.info('Using accumulated income total', {
          component: 'xero-report-fetcher',
          totalRevenue: incomeTotal
        });
      }
      
      if (summary.totalExpenses === 0 && expenseTotal > 0) {
        summary.totalExpenses = expenseTotal;
        structuredLogger.info('Using accumulated expense total', {
          component: 'xero-report-fetcher',
          totalExpenses: expenseTotal
        });
      }
      
      // Calculate derived values if not found
      if (summary.grossProfit === 0 && summary.totalRevenue > 0 && costOfSalesTotal > 0) {
        summary.grossProfit = summary.totalRevenue - costOfSalesTotal;
      }
      
      if (summary.netProfit === 0 && summary.totalRevenue > 0) {
        summary.netProfit = summary.totalRevenue - summary.totalExpenses;
      }
      
      // Log comprehensive final summary
      structuredLogger.info('FINAL P&L PARSING SUMMARY', {
        component: 'xero-report-fetcher',
        foundValues,
        finalSummary: summary,
        calculations: {
          incomeTotal,
          expenseTotal,
          costOfSalesTotal,
          calculatedNetProfit: summary.totalRevenue - summary.totalExpenses
        }
      });
      
      // Write final summary to development log
      try {
        fs.appendFileSync('development.log', 
          `\n=== P&L FINAL PARSING RESULTS ===\n` +
          `Total Revenue: £${summary.totalRevenue.toFixed(2)}\n` +
          `Total Expenses: £${summary.totalExpenses.toFixed(2)}\n` +
          `Gross Profit: £${summary.grossProfit.toFixed(2)}\n` +
          `Operating Expenses: £${summary.operatingExpenses.toFixed(2)}\n` +
          `Net Profit: £${summary.netProfit.toFixed(2)}\n` +
          `Other Income: £${summary.otherIncome.toFixed(2)}\n` +
          `Other Expenses: £${summary.otherExpenses.toFixed(2)}\n` +
          `\nFound Values: ${JSON.stringify(foundValues, null, 2)}\n`
        );
      } catch (logError) {
        // Silent fail
      }
      
      structuredLogger.info('P&L summary calculated successfully', {
        component: 'xero-report-fetcher',
        tenantId,
        summary,
        fromDate: fromDate?.toISOString().split('T')[0],
        toDate: toDate?.toISOString().split('T')[0]
      });
      
      return summary;
    } catch (error) {
      structuredLogger.error('Failed to fetch P&L summary', error, {
        component: 'xero-report-fetcher',
        tenantId
      });
      throw error;
    }
  }
  
  /**
   * Fetch detailed Profit & Loss with all account-level data
   */
  static async fetchDetailedProfitLoss(
    tenantId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<DetailedProfitLoss> {
    try {
      const xeroClient = await getXeroClient();
      if (!xeroClient) {
        throw new Error('Xero client not available');
      }
      
      structuredLogger.info('[XeroReportFetcher] Fetching detailed P&L report', {
        component: 'xero-report-fetcher',
        fromDate: fromDate?.toISOString().split('T')[0],
        toDate: toDate?.toISOString().split('T')[0],
        tenantId
      });
      
      // Log to development.log for debugging
      try {
        const fs = require('fs');
        fs.appendFileSync('development.log', 
          `\n[${new Date().toISOString()}] [XeroReportFetcher] Requesting P&L from Xero API:\n` +
          `  From Date: ${fromDate?.toISOString().split('T')[0] || 'undefined'}\n` +
          `  To Date: ${toDate?.toISOString().split('T')[0] || 'undefined'}\n` +
          `  Tenant ID: ${tenantId}\n`
        );
      } catch (logError) {
        // Silent fail
      }
      
      // Use the profit and loss endpoint with date parameters
      // Try with standardLayout = false to get all accounts
      const response = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => client.accountingApi.getReportProfitAndLoss(
          tenantId,
          fromDate?.toISOString().split('T')[0],
          toDate?.toISOString().split('T')[0],
          undefined, // periods
          undefined, // timeframe
          undefined, // trackingCategoryID
          undefined, // trackingCategoryID2
          undefined, // trackingOptionID
          undefined, // trackingOptionID2
          false, // standardLayout - set to false to get all accounts
          false // paymentsOnly
        )
      );
      
      // Log API call parameters
      structuredLogger.info('[XeroReportFetcher] P&L API call parameters', {
        component: 'xero-report-fetcher',
        fromDate: fromDate?.toISOString().split('T')[0],
        toDate: toDate?.toISOString().split('T')[0],
        standardLayout: false,
        paymentsOnly: false
      });
      
      const report = response?.body?.reports?.[0] || response?.reports?.[0];
      
      if (!report || !report.rows) {
        structuredLogger.error('[XeroReportFetcher] No P&L data in response', {
          component: 'xero-report-fetcher',
          hasResponse: !!response,
          hasBody: !!response?.body,
          hasReports: !!response?.body?.reports || !!response?.reports,
          reportCount: response?.body?.reports?.length || response?.reports?.length || 0
        });
        throw new Error('No P&L data found in Xero response');
      }
      
      // Initialize the detailed P&L structure with all required properties
      const detailedPL: DetailedProfitLoss = {
        revenue: {
          accounts: [],
          totalRevenue: 0
        },
        otherIncome: {
          accounts: [],
          totalOtherIncome: 0
        },
        costOfGoodsSold: {
          accounts: [],
          totalCostOfGoodsSold: 0
        },
        operatingExpenses: {
          accounts: [],
          totalOperatingExpenses: 0
        },
        otherExpenses: {
          accounts: [],
          totalOtherExpenses: 0
        },
        totalRevenue: 0,
        totalExpenses: 0,
        grossProfit: 0,
        netProfit: 0,
        totalOperatingExpenses: 0,
        totalOtherIncome: 0,
        totalOtherExpenses: 0,
        periodStart: fromDate?.toISOString().split('T')[0],
        periodEnd: toDate?.toISOString().split('T')[0],
        source: 'xero_direct',
        fetchedAt: new Date().toISOString()
      };
      
      // Log the initial structure
      structuredLogger.info('[XeroReportFetcher] Initialized P&L structure', {
        component: 'xero-report-fetcher',
        hasRevenue: !!detailedPL.revenue,
        hasOtherIncome: !!detailedPL.otherIncome,
        hasCostOfGoodsSold: !!detailedPL.costOfGoodsSold,
        hasOperatingExpenses: !!detailedPL.operatingExpenses,
        hasOtherExpenses: !!detailedPL.otherExpenses
      });
      
      // Find the value column index
      let valueColumnIndex = 1;
      const headerRow = report.rows?.find((row: any) => row.rowType === 'Header');
      if (headerRow && headerRow.cells) {
        // Usually the value is in the second column (index 1)
        if (headerRow.cells.length >= 2) {
          valueColumnIndex = 1;
        }
      }
      
      // Helper function to extract value from row
      const extractValue = (row: any): number => {
        if (!row.cells || row.cells.length <= valueColumnIndex) return 0;
        
        const value = row.cells[valueColumnIndex]?.value;
        if (value !== undefined && value !== null && value !== '') {
          const valueStr = value.toString();
          const isNegative = valueStr.includes('(') && valueStr.includes(')');
          const cleanValue = valueStr.replace(/[$£€,()]/g, '').trim();
          const num = parseFloat(cleanValue);
          if (isNaN(num)) return 0;
          return isNegative ? -num : num;
        }
        return 0;
      };
      
      // Helper function to extract account ID from row
      const extractAccountId = (row: any): string | undefined => {
        if (!row.cells || row.cells.length <= valueColumnIndex) return undefined;
        
        const attributes = row.cells[valueColumnIndex]?.attributes;
        if (attributes && Array.isArray(attributes)) {
          const accountAttr = attributes.find((attr: any) => attr.id === 'account');
          return accountAttr?.value;
        }
        return undefined;
      };
      
      // Write raw report structure to development log
      try {
        const fs = require('fs');
        fs.appendFileSync('development.log', 
          `\n=== DETAILED P&L REPORT STRUCTURE ${new Date().toISOString()} ===\n` +
          `Period: ${fromDate?.toISOString().split('T')[0]} to ${toDate?.toISOString().split('T')[0]}\n` +
          `Report Title: ${report.reportTitle || 'N/A'}\n` +
          `Report Name: ${report.reportName || 'N/A'}\n` +
          `Report Date: ${report.reportDate || 'N/A'}\n` +
          `Sections: ${JSON.stringify(report.rows?.map((s: any) => ({ 
            rowType: s.rowType, 
            title: s.title, 
            rows: s.rows?.length,
            cells: s.cells?.length
          })), null, 2)}\n`
        );
        
        // Also log the first few rows of each section to see the data
        report.rows?.forEach((section: any, idx: number) => {
          if (section.rowType === 'Section' && section.rows) {
            fs.appendFileSync('development.log', 
              `\nSection ${idx}: "${section.title}" (${section.rows.length} rows)\n`
            );
            section.rows.slice(0, 3).forEach((row: any, rowIdx: number) => {
              if (row.cells) {
                fs.appendFileSync('development.log', 
                  `  Row ${rowIdx}: [${row.cells.map((c: any) => c?.value || '').join(', ')}]\n`
                );
              }
            });
          }
        });
      } catch (logError) {
        // Silent fail
      }
      
      // Process report sections
      report.rows.forEach((section: any, sectionIndex: number) => {
        try {
          if (section.rowType === 'Section' && section.rows) {
            const sectionTitle = section.title || '';
            const sectionLower = sectionTitle.toLowerCase();
            
            structuredLogger.info('[XeroReportFetcher] Processing P&L section', {
              component: 'xero-report-fetcher',
              sectionIndex,
              sectionTitle,
              rowCount: section.rows?.length || 0
            });
            
            section.rows.forEach((row: any, rowIndex: number) => {
              try {
            if (!row.cells || row.cells.length < 2) return;
            
            const accountName = row.cells[0]?.value || '';
            const value = extractValue(row);
            const accountId = extractAccountId(row);
            const labelLower = accountName.toLowerCase();
            
            // Log every row for debugging
            structuredLogger.debug(`[XeroReportFetcher] P&L row ${sectionIndex}.${rowIndex}`, {
              component: 'xero-report-fetcher',
              accountName,
              value,
              accountId,
              sectionTitle,
              cells: row.cells.map((c: any) => c?.value)
            });
            
            // Skip total rows and summary rows but capture their values
            if (labelLower.includes('total') || 
                labelLower === 'gross profit' || labelLower === 'gross margin' ||
                labelLower === 'net profit' || labelLower === 'net income' ||
                labelLower === 'operating profit' || labelLower === 'profit' ||
                labelLower.includes('profit/(loss)') || labelLower.includes('profit before') ||
                labelLower.includes('profit after')) {
              
              // Handle section totals based on exact section titles from Xero
              if (labelLower.includes('total')) {
                if (sectionTitle === 'Income' || sectionTitle === 'Revenue' || 
                    sectionTitle === 'Trading Income' || sectionTitle === 'Sales') {
                  detailedPL.revenue.totalRevenue = Math.abs(value);
                } else if (sectionTitle === 'Plus Other Income') {
                  detailedPL.otherIncome.totalOtherIncome = Math.abs(value);
                } else if (sectionTitle === 'Less Cost of Sales' || sectionTitle === 'Cost of Sales' ||
                           sectionLower.includes('cost of') || sectionLower.includes('direct costs')) {
                  detailedPL.costOfGoodsSold.totalCostOfGoodsSold = Math.abs(value);
                } else if (sectionTitle === 'Less Operating Expenses') {
                  detailedPL.operatingExpenses.totalOperatingExpenses = Math.abs(value);
                } else if (sectionTitle === 'Less Other Expenses') {
                  detailedPL.otherExpenses.totalOtherExpenses = Math.abs(value);
                }
                
                structuredLogger.info('[XeroReportFetcher] Found section total', {
                  component: 'xero-report-fetcher',
                  sectionTitle,
                  totalType: labelLower,
                  value: Math.abs(value)
                });
              } else if (labelLower === 'gross profit' || labelLower === 'gross margin') {
                // Capture gross profit value but don't add as an account
                detailedPL.grossProfit = value;
                structuredLogger.info('[XeroReportFetcher] Found gross profit', {
                  component: 'xero-report-fetcher',
                  grossProfit: value
                });
              } else if (labelLower.includes('net profit') || labelLower.includes('net income') ||
                         labelLower.includes('profit/(loss)')) {
                // Capture net profit value but don't add as an account
                detailedPL.netProfit = value;
                structuredLogger.info('[XeroReportFetcher] Found net profit', {
                  component: 'xero-report-fetcher',
                  netProfit: value
                });
              }
              
              // Skip adding this as an account
              return;
            }
            
            // Skip completely empty rows (no account name and zero value)
            if (!accountName && value === 0) {
              return;
            }
            
            // Create account object
            const account: ProfitLossAccount = {
              accountId,
              accountName,
              amount: Math.abs(value)
            };
            
            // Categorize based on section - handle Xero's actual section titles
            // Add safety checks to ensure arrays exist
            if (!detailedPL.revenue.accounts) detailedPL.revenue.accounts = [];
            if (!detailedPL.otherIncome.accounts) detailedPL.otherIncome.accounts = [];
            if (!detailedPL.costOfGoodsSold.accounts) detailedPL.costOfGoodsSold.accounts = [];
            if (!detailedPL.operatingExpenses.accounts) detailedPL.operatingExpenses.accounts = [];
            if (!detailedPL.otherExpenses.accounts) detailedPL.otherExpenses.accounts = [];
            
            // Check exact section titles first
            if (sectionTitle === 'Less Cost of Sales' || sectionTitle === 'Cost of Sales') {
              detailedPL.costOfGoodsSold.accounts.push(account);
            } else if (sectionTitle === 'Plus Other Income') {
              detailedPL.otherIncome.accounts.push(account);
            } else if (sectionTitle === 'Less Operating Expenses') {
              detailedPL.operatingExpenses.accounts.push(account);
            } else if (sectionTitle === 'Less Other Expenses') {
              detailedPL.otherExpenses.accounts.push(account);
            } else if (sectionTitle === 'Income' || sectionTitle === 'Revenue' || 
                       sectionTitle === 'Trading Income' || sectionTitle === 'Sales') {
              detailedPL.revenue.accounts.push(account);
            } else if (sectionLower.includes('income') || sectionLower.includes('revenue') || 
                       sectionLower.includes('trading income') || sectionLower.includes('sales')) {
              if (sectionLower.includes('other')) {
                detailedPL.otherIncome.accounts.push(account);
              } else {
                detailedPL.revenue.accounts.push(account);
              }
            } else if (sectionLower.includes('cost of') || sectionLower.includes('cost of goods') || 
                       sectionLower.includes('direct costs')) {
              detailedPL.costOfGoodsSold.accounts.push(account);
            } else if (sectionLower.includes('operating expense')) {
              detailedPL.operatingExpenses.accounts.push(account);
            } else if (sectionLower.includes('other expense')) {
              detailedPL.otherExpenses.accounts.push(account);
            } else if (sectionLower.includes('expense')) {
              // Default expenses to operating expenses
              detailedPL.operatingExpenses.accounts.push(account);
            } else {
              // For empty sections, try to categorize based on account name
              const accountNameLower = accountName.toLowerCase();
              if (accountNameLower.includes('cost of') || accountNameLower.includes('cogs') ||
                  accountNameLower.includes('manufacturing') || accountNameLower.includes('freight')) {
                detailedPL.costOfGoodsSold.accounts.push(account);
              } else if (accountNameLower.includes('revenue') || accountNameLower.includes('sales') ||
                         accountNameLower.includes('income')) {
                detailedPL.revenue.accounts.push(account);
              } else {
                // Default uncategorized to operating expenses
                detailedPL.operatingExpenses.accounts.push(account);
              }
            }
            
            // Log the categorization for debugging
            let categorizedTo = 'uncategorized';
            if (sectionTitle === 'Less Cost of Sales' || sectionTitle === 'Cost of Sales') {
              categorizedTo = 'costOfGoodsSold';
            } else if (sectionTitle === 'Plus Other Income') {
              categorizedTo = 'otherIncome';
            } else if (sectionTitle === 'Less Operating Expenses') {
              categorizedTo = 'operatingExpenses';
            } else if (sectionTitle === 'Less Other Expenses') {
              categorizedTo = 'otherExpenses';
            } else if (sectionTitle === 'Income' || sectionTitle === 'Revenue' || 
                       sectionTitle === 'Trading Income' || sectionTitle === 'Sales') {
              categorizedTo = 'revenue';
            } else if (sectionLower.includes('income') || sectionLower.includes('revenue')) {
              categorizedTo = sectionLower.includes('other') ? 'otherIncome' : 'revenue';
            } else if (sectionLower.includes('cost of') || sectionLower.includes('direct costs')) {
              categorizedTo = 'costOfGoodsSold';
            } else if (sectionLower.includes('expense')) {
              categorizedTo = sectionLower.includes('other') ? 'otherExpenses' : 'operatingExpenses';
            } else {
              // For empty sections, based on account name
              const accountNameLower = accountName.toLowerCase();
              if (accountNameLower.includes('cost of') || accountNameLower.includes('cogs') ||
                  accountNameLower.includes('manufacturing') || accountNameLower.includes('freight')) {
                categorizedTo = 'costOfGoodsSold';
              } else if (accountNameLower.includes('revenue') || accountNameLower.includes('sales') ||
                         accountNameLower.includes('income')) {
                categorizedTo = 'revenue';
              } else {
                categorizedTo = 'operatingExpenses';
              }
            }
            
            structuredLogger.debug('[XeroReportFetcher] Categorized account', {
              component: 'xero-report-fetcher',
              accountName,
              sectionTitle,
              sectionLower,
              categorizedTo
            });
              } catch (rowError) {
                structuredLogger.error('[XeroReportFetcher] Error processing P&L row', {
                  component: 'xero-report-fetcher',
                  error: rowError instanceof Error ? rowError.message : String(rowError),
                  sectionIndex,
                  rowIndex,
                  sectionTitle
                });
              }
            });
          } else if (section.rowType === 'Row' && section.cells) {
          // Handle root-level rows (like final totals)
          const label = section.cells[0]?.value || '';
          const value = extractValue(section);
          const labelLower = label.toLowerCase();
          
          structuredLogger.info('[XeroReportFetcher] Processing root-level row', {
            component: 'xero-report-fetcher',
            label,
            value,
            cells: section.cells.map((c: any) => c?.value)
          });
          
          if (labelLower === 'gross profit' || labelLower === 'gross margin') {
            detailedPL.grossProfit = value;
          } else if (labelLower.includes('net profit') || labelLower.includes('net income') ||
                     labelLower.includes('profit/(loss)')) {
            detailedPL.netProfit = value;
          }
        } else if (section.rowType === 'Section' && section.title === '' && section.rows) {
          // Handle empty section title (like the first section with Gross Profit)
          structuredLogger.info('[XeroReportFetcher] Processing section with empty title', {
            component: 'xero-report-fetcher',
            rowCount: section.rows?.length || 0
          });
          
          section.rows.forEach((row: any) => {
            if (row.cells && row.cells.length >= 2) {
              const label = row.cells[0]?.value || '';
              const value = extractValue(row);
              const labelLower = label.toLowerCase();
              
              if (labelLower === 'gross profit' || labelLower === 'gross margin') {
                detailedPL.grossProfit = value;
                structuredLogger.info('[XeroReportFetcher] Found gross profit in empty section', {
                  component: 'xero-report-fetcher',
                  grossProfit: value
                });
              }
            }
          });
          }
        } catch (sectionError) {
          structuredLogger.error('[XeroReportFetcher] Error processing P&L section', {
            component: 'xero-report-fetcher',
            error: sectionError instanceof Error ? sectionError.message : String(sectionError),
            sectionIndex,
            stack: sectionError instanceof Error ? sectionError.stack : undefined
          });
        }
      });
      
      // Calculate totals if not already set
      if (detailedPL.revenue.totalRevenue === 0) {
        detailedPL.revenue.totalRevenue = detailedPL.revenue.accounts
          .reduce((sum, acc) => sum + acc.amount, 0);
      }
      if (detailedPL.otherIncome.totalOtherIncome === 0) {
        detailedPL.otherIncome.totalOtherIncome = detailedPL.otherIncome.accounts
          .reduce((sum, acc) => sum + acc.amount, 0);
      }
      if (detailedPL.costOfGoodsSold.totalCostOfGoodsSold === 0) {
        detailedPL.costOfGoodsSold.totalCostOfGoodsSold = detailedPL.costOfGoodsSold.accounts
          .reduce((sum, acc) => sum + acc.amount, 0);
      }
      if (detailedPL.operatingExpenses.totalOperatingExpenses === 0) {
        detailedPL.operatingExpenses.totalOperatingExpenses = detailedPL.operatingExpenses.accounts
          .reduce((sum, acc) => sum + acc.amount, 0);
      }
      if (detailedPL.otherExpenses.totalOtherExpenses === 0) {
        detailedPL.otherExpenses.totalOtherExpenses = detailedPL.otherExpenses.accounts
          .reduce((sum, acc) => sum + acc.amount, 0);
      }
      
      // Set summary values
      detailedPL.totalRevenue = detailedPL.revenue.totalRevenue + detailedPL.otherIncome.totalOtherIncome;
      detailedPL.totalExpenses = detailedPL.costOfGoodsSold.totalCostOfGoodsSold + 
                                  detailedPL.operatingExpenses.totalOperatingExpenses + 
                                  detailedPL.otherExpenses.totalOtherExpenses;
      
      // Set the summary number properties
      detailedPL.totalOperatingExpenses = detailedPL.operatingExpenses.totalOperatingExpenses;
      detailedPL.totalOtherIncome = detailedPL.otherIncome.totalOtherIncome;
      detailedPL.totalOtherExpenses = detailedPL.otherExpenses.totalOtherExpenses;
      
      // Calculate derived values if not found
      if (detailedPL.grossProfit === 0) {
        detailedPL.grossProfit = detailedPL.revenue.totalRevenue - detailedPL.costOfGoodsSold.totalCostOfGoodsSold;
      }
      if (detailedPL.netProfit === 0) {
        detailedPL.netProfit = detailedPL.totalRevenue - detailedPL.totalExpenses;
      }
      
      structuredLogger.info('[XeroReportFetcher] Detailed P&L fetched successfully', {
        component: 'xero-report-fetcher',
        totalRevenue: detailedPL.totalRevenue,
        totalExpenses: detailedPL.totalExpenses,
        netProfit: detailedPL.netProfit,
        grossProfit: detailedPL.grossProfit,
        revenueAccountsCount: detailedPL.revenue.accounts.length,
        otherIncomeAccountsCount: detailedPL.otherIncome.accounts.length,
        cogsAccountsCount: detailedPL.costOfGoodsSold.accounts.length,
        operatingExpenseAccountsCount: detailedPL.operatingExpenses.accounts.length,
        otherExpenseAccountsCount: detailedPL.otherExpenses.accounts.length,
        summaryTotals: {
          totalOperatingExpenses: detailedPL.totalOperatingExpenses,
          totalOtherIncome: detailedPL.totalOtherIncome,
          totalOtherExpenses: detailedPL.totalOtherExpenses
        }
      });
      
      // Add warning if no revenue accounts found
      if (detailedPL.revenue.accounts.length === 0 && detailedPL.totalRevenue === 0) {
        structuredLogger.warn('[XeroReportFetcher] No revenue accounts found in P&L report', {
          component: 'xero-report-fetcher',
          period: `${fromDate?.toISOString().split('T')[0]} to ${toDate?.toISOString().split('T')[0]}`,
          note: 'This may indicate no revenue transactions for this period or a data issue'
        });
        
        // Add metadata about missing revenue
        (detailedPL as any).warnings = [
          'No revenue accounts found in the Profit & Loss report for this period.',
          'This could mean: 1) No sales were recorded, 2) Revenue accounts have zero balance, or 3) Chart of Accounts needs to be synced.'
        ];
      }
      
      // Write to development log
      try {
        const fs = require('fs');
        fs.appendFileSync('development.log', 
          `\n=== DETAILED P&L FETCH ${new Date().toISOString()} ===\n` +
          `Period: ${detailedPL.periodStart} to ${detailedPL.periodEnd}\n` +
          `Revenue Accounts: ${JSON.stringify(detailedPL.revenue.accounts, null, 2)}\n` +
          `Other Income Accounts: ${JSON.stringify(detailedPL.otherIncome.accounts, null, 2)}\n` +
          `Operating Expense Accounts: ${JSON.stringify(detailedPL.operatingExpenses.accounts, null, 2)}\n` +
          `Summary: Revenue=${detailedPL.totalRevenue}, Expenses=${detailedPL.totalExpenses}, NetProfit=${detailedPL.netProfit}\n` +
          (detailedPL.revenue.accounts.length === 0 ? `⚠️ WARNING: No revenue accounts found!\n` : '')
        );
      } catch (logError) {
        // Silent fail
      }
      
      return detailedPL;
    } catch (error) {
      structuredLogger.error('[XeroReportFetcher] Failed to fetch detailed P&L', error, {
        component: 'xero-report-fetcher',
        tenantId
      });
      throw error;
    }
  }
  
  /**
   * Fetch Trial Balance for detailed account balances
   */
  static async fetchTrialBalance(
    tenantId: string,
    date?: Date
  ): Promise<TrialBalanceSummary> {
    try {
      const xeroClient = await getXeroClient();
      if (!xeroClient) {
        throw new Error('Xero client not available');
      }
      
      const response = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => client.accountingApi.getReportTrialBalance(
          tenantId,
          date?.toISOString(),
          false // paymentsOnly
        )
      );
      
      const report = response?.body?.reports?.[0];
      const accounts: TrialBalanceSummary['accounts'] = [];
      let totalDebits = 0;
      let totalCredits = 0;
      
      if (report && report.rows) {
        // Find the section with account data
        const accountSection = report.rows.find(
          (row: any) => row.rowType === 'Section' && row.rows
        );
        
        if (accountSection) {
          accountSection.rows.forEach((row: any) => {
            if (row.rowType === 'Row' && row.cells?.length >= 4) {
              const accountName = row.cells[0]?.value || '';
              const debit = parseFloat(row.cells[1]?.value || '0');
              const credit = parseFloat(row.cells[2]?.value || '0');
              const ytd = parseFloat(row.cells[3]?.value || '0');
              
              // Extract account code from name if present
              const codeMatch = accountName.match(/^(\d+)\s*-\s*(.+)$/);
              const accountCode = codeMatch ? codeMatch[1] : '';
              const cleanName = codeMatch ? codeMatch[2] : accountName;
              
              accounts.push({
                accountId: '', // Would need to match with accounts API
                accountName: cleanName,
                accountCode: accountCode,
                accountType: '', // Would need to match with accounts API
                debit: debit,
                credit: credit,
                balance: ytd
              });
              
              totalDebits += debit;
              totalCredits += credit;
            }
          });
        }
      }
      
      return {
        accounts,
        totalDebits,
        totalCredits
      };
    } catch (error) {
      structuredLogger.error('Failed to fetch trial balance', error, {
        component: 'xero-report-fetcher',
        tenantId
      });
      throw error;
    }
  }
  
  /**
   * Calculate VAT liability from trial balance
   */
  static async calculateVATLiability(tenantId: string): Promise<number> {
    try {
      const trialBalance = await this.fetchTrialBalance(tenantId);
      
      // Find VAT/GST accounts
      let vatLiability = 0;
      trialBalance.accounts.forEach(account => {
        const name = account.accountName.toLowerCase();
        if (
          name.includes('vat') || 
          name.includes('gst') || 
          name.includes('tax payable') ||
          name.includes('tax collected')
        ) {
          // VAT liability accounts typically have credit balances
          vatLiability += account.balance;
        }
      });
      
      return Math.abs(vatLiability);
    } catch (error) {
      structuredLogger.error('Failed to calculate VAT liability', error, {
        component: 'xero-report-fetcher',
        tenantId
      });
      return 0;
    }
  }

  /**
   * Fetch Cash Flow Statement from Xero
   * Uses Executive Summary report which includes cash flow data
   */
  /**
   * Fetch detailed Cash Summary using Bank Summary report
   * This provides more detailed cash movements than Executive Summary
   */
  static async fetchDetailedCashSummary(
    tenantId: string,
    fromDate?: Date,
    toDate?: Date,
    periods: number = 1
  ): Promise<any> {
    try {
      const xeroClient = await getXeroClient();
      if (!xeroClient) {
        throw new Error('Xero client not available');
      }

      structuredLogger.info('Fetching detailed cash summary from Bank Summary report', {
        component: 'xero-report-fetcher',
        tenantId,
        fromDate: fromDate?.toISOString(),
        toDate: toDate?.toISOString(),
        periods
      });

      // Fetch Bank Summary report which contains detailed cash movements
      const response = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => client.accountingApi.getReportBankSummary(
          tenantId,
          fromDate?.toISOString().split('T')[0],
          toDate?.toISOString().split('T')[0]
        )
      );

      const report = response?.body?.reports?.[0] || response?.reports?.[0];
      
      if (!report || !report.rows) {
        throw new Error('No bank summary data found');
      }

      // Log to development.log for debugging
      try {
        const fs = require('fs');
        fs.appendFileSync('development.log', 
          `\n=== BANK SUMMARY REPORT STRUCTURE ${new Date().toISOString()} ===\n` +
          `Period: ${fromDate?.toISOString().split('T')[0]} to ${toDate?.toISOString().split('T')[0]}\n` +
          `Report Name: ${report.reportName}\n` +
          `Report Title: ${report.reportTitle}\n` +
          `Sections: ${JSON.stringify(report.rows?.map((s: any) => ({
            type: s.rowType,
            title: s.title,
            rowCount: s.rows?.length
          })), null, 2)}\n` +
          `=== END BANK SUMMARY STRUCTURE ===\n`
        );
      } catch (logError) {
        // Silent fail
      }

      // Process the bank summary into cash summary format
      const cashSummary = {
        reportName: 'Cash Summary',
        fromDate: fromDate?.toISOString().split('T')[0],
        toDate: toDate?.toISOString().split('T')[0],
        accounts: [] as any[],
        totalCashMovement: 0,
        openingBalance: 0,
        closingBalance: 0
      };

      // Process each section
      report.rows.forEach((section: any) => {
        if (section.rowType === 'Section' && section.rows) {
          section.rows.forEach((row: any) => {
            if (row.rowType === 'Row' && row.cells && row.cells.length >= 6) {
              const accountName = row.cells[0]?.value;
              const openingBalance = parseFloat(row.cells[1]?.value || '0');
              const cashReceived = parseFloat(row.cells[2]?.value || '0');
              const cashSpent = parseFloat(row.cells[3]?.value || '0');
              const fxGain = parseFloat(row.cells[4]?.value || '0');
              const closingBalance = parseFloat(row.cells[5]?.value || '0');
              const netMovement = cashReceived - cashSpent + fxGain;

              if (accountName && accountName !== 'Total') {
                const accountId = row.cells[0]?.attributes?.find((attr: any) => attr.id === 'accountID')?.value;
                cashSummary.accounts.push({
                  accountId,
                  accountName,
                  openingBalance,
                  cashReceived,
                  cashSpent,
                  fxGain,
                  netMovement,
                  closingBalance
                });
              }
            } else if (row.rowType === 'SummaryRow' && row.cells && row.cells.length >= 6) {
              // Track totals from summary row
              cashSummary.openingBalance = parseFloat(row.cells[1]?.value || '0');
              const totalReceived = parseFloat(row.cells[2]?.value || '0');
              const totalSpent = parseFloat(row.cells[3]?.value || '0');
              const totalFxGain = parseFloat(row.cells[4]?.value || '0');
              cashSummary.closingBalance = parseFloat(row.cells[5]?.value || '0');
              cashSummary.totalCashMovement = totalReceived - totalSpent + totalFxGain;
            }
          });
        }
      });

      structuredLogger.info('Detailed cash summary processed', {
        component: 'xero-report-fetcher',
        accountCount: cashSummary.accounts.length,
        totalMovement: cashSummary.totalCashMovement
      });

      return cashSummary;
    } catch (error) {
      structuredLogger.error('Failed to fetch detailed cash summary', error, {
        component: 'xero-report-fetcher',
        tenantId
      });
      throw error;
    }
  }

  /**
   * Fetch actual Cash Flow Statement from Xero
   * This shows Operating, Investing, and Financing activities
   */
  static async fetchCashFlowStatement(
    tenantId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<any> {
    const fetchStart = Date.now()
    let status = 'COMPLETED'
    let recordCount = 0
    let error = null

    try {
      const xeroClient = await getXeroClient();
      if (!xeroClient) {
        throw new Error('Xero client not available');
      }

      const startDate = fromDate?.toISOString().split('T')[0] || '';
      const endDate = toDate?.toISOString().split('T')[0] || '';

      structuredLogger.info('[XeroReportFetcher] Fetching Cash Flow Statement', {
        component: 'xero-report-fetcher',
        tenantId,
        startDate,
        endDate
      })

      // Xero doesn't have a dedicated Cash Flow Statement API
      // We'll use Bank Summary and format it as a Cash Flow Statement
      structuredLogger.info('[XeroReportFetcher] Calling getReportBankSummary', {
        component: 'xero-report-fetcher',
        tenantId,
        startDate,
        endDate
      })

      const response = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => client.accountingApi.getReportBankSummary(
          tenantId,
          fromDate || new Date(startDate),
          toDate || new Date(endDate)
        )
      )

      structuredLogger.info('[XeroReportFetcher] Bank Summary API response', {
        component: 'xero-report-fetcher',
        hasResponse: !!response,
        hasBody: !!response?.body,
        hasReports: !!response?.body?.reports,
        reportsLength: response?.body?.reports?.length || 0
      })

      if (!response?.body?.reports?.length) {
        structuredLogger.error('[XeroReportFetcher] No reports in response', {
          component: 'xero-report-fetcher',
          response: JSON.stringify(response)
        })
        throw new Error('No cash flow statement data returned from Xero')
      }

      const report = response.body.reports[0]
      
      // Log raw report structure for debugging
      try {
        const fs = require('fs');
        fs.appendFileSync('development.log', 
          `\n=== CASH FLOW STATEMENT RAW REPORT ${new Date().toISOString()} ===\n` +
          `Period: ${startDate} to ${endDate}\n` +
          `Report Name: ${report.reportName}\n` +
          `Report Type: ${report.reportType}\n` +
          `Rows: ${JSON.stringify(report.rows?.slice(0, 5), null, 2)}\n` +
          `=== END CASH FLOW STATEMENT ===\n`
        );
      } catch (logError) {
        // Silent fail
      }
      
      // Parse the bank summary using our existing parser
      const bankSummaryData = XeroCashSummaryParser.parse(response.body)
      
      // Transform Bank Summary into Cash Flow Statement format
      const cashFlowData = {
        reportName: "Cash Flow Statement",
        fromDate: startDate,
        toDate: endDate,
        operatingActivities: [
          {
            name: "Net Cash Movement from Operations",
            amount: bankSummaryData.accounts?.reduce((sum: number, acc: any) => 
              sum + (acc.cashReceived || 0) - (acc.cashSpent || 0), 0) || 0
          }
        ],
        investingActivities: [],
        financingActivities: [],
        netOperatingCashFlow: bankSummaryData.accounts?.reduce((sum: number, acc: any) => 
          sum + (acc.cashReceived || 0) - (acc.cashSpent || 0), 0) || 0,
        netInvestingCashFlow: 0,
        netFinancingCashFlow: 0,
        totalNetCashFlow: bankSummaryData.accounts?.reduce((sum: number, acc: any) => 
          sum + (acc.netMovement || 0), 0) || 0,
        openingBalance: bankSummaryData.accounts?.reduce((sum: number, acc: any) => 
          sum + (acc.openingBalance || 0), 0) || 0,
        closingBalance: bankSummaryData.accounts?.reduce((sum: number, acc: any) => 
          sum + (acc.closingBalance || 0), 0) || 0,
        accounts: bankSummaryData.accounts // Include account details for reference
      }

      // Add report metadata
      const result = {
        ...cashFlowData,
        reportName: 'Cash Flow Statement',
        reportType: 'CashflowStatement',
        periodDescription: report.reportTitles?.join(' ') || `${startDate} to ${endDate}`
      }

      recordCount = 3 // Operating, Investing, Financing sections
      
      structuredLogger.info('[XeroReportFetcher] Cash Flow Statement fetched successfully', {
        component: 'xero-report-fetcher',
        tenantId,
        startDate,
        endDate,
        netCashFlow: cashFlowData.totalNetCashFlow,
        operatingCashFlow: cashFlowData.netOperatingCashFlow,
        investingCashFlow: cashFlowData.netInvestingCashFlow,
        financingCashFlow: cashFlowData.netFinancingCashFlow
      })

      // Log to ImportedReport table
      try {
        await prisma.importedReport.create({
          data: {
            type: 'CASH_FLOW',
            source: 'API',
            periodStart: fromDate || new Date(startDate),
            periodEnd: toDate || new Date(endDate),
            importedBy: 'System',
            status,
            recordCount,
            processedData: JSON.stringify(result),
            metadata: JSON.stringify({
              reportName: 'Cash Flow Statement',
              tenantId,
              fetchDuration: Date.now() - fetchStart
            })
          }
        })
      } catch (dbError) {
        structuredLogger.error('[XeroReportFetcher] Failed to log to database', {
          error: dbError,
          component: 'xero-report-fetcher'
        })
      }

      return result
    } catch (err: any) {
      status = 'FAILED'
      error = err.message
      
      structuredLogger.error('[XeroReportFetcher] Failed to fetch cash flow statement', {
        component: 'xero-report-fetcher',
        error: err.message,
        tenantId,
        fromDate: fromDate?.toISOString(),
        toDate: toDate?.toISOString()
      })

      // Log failure to database
      try {
        await prisma.importedReport.create({
          data: {
            type: 'CASH_FLOW',
            source: 'API',
            periodStart: fromDate || new Date(),
            periodEnd: toDate || new Date(),
            importedBy: 'System',
            status,
            recordCount,
            errorLog: error,
            metadata: JSON.stringify({
              reportName: 'Cash Flow Statement',
              tenantId,
              error: err.message,
              fetchDuration: Date.now() - fetchStart
            })
          }
        })
      } catch (dbError) {
        structuredLogger.error('[XeroReportFetcher] Failed to log error to database', {
          error: dbError,
          component: 'xero-report-fetcher'
        })
      }

      throw err
    } finally {
      const duration = Date.now() - fetchStart
      structuredLogger.info('[XeroReportFetcher] Cash flow statement fetch completed', {
        component: 'xero-report-fetcher',
        duration,
        status
      })
    }
  }

  static async fetchCashFlowSummary(
    tenantId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<CashFlowSummary> {
    try {
      const xeroClient = await getXeroClient();
      if (!xeroClient) {
        throw new Error('Xero client not available');
      }

      structuredLogger.info('Fetching cash flow data', {
        component: 'xero-report-fetcher',
        tenantId,
        fromDate: fromDate?.toISOString(),
        toDate: toDate?.toISOString()
      });

      // First, try Executive Summary which contains cash flow data
      try {
        structuredLogger.info('Attempting to fetch Executive Summary', {
          component: 'xero-report-fetcher',
          tenantId,
          fromDate: fromDate?.toISOString(),
          toDate: toDate?.toISOString()
        });

        const execSummaryResponse = await executeXeroAPICall<any>(
          xeroClient,
          tenantId,
          (client) => client.accountingApi.getReportExecutiveSummary(
            tenantId,
            fromDate,
            toDate
          )
        );

        // The response structure might be different - check both body and direct response
        const responseData = execSummaryResponse?.body || execSummaryResponse;
        
        structuredLogger.info('Executive Summary response received', {
          component: 'xero-report-fetcher',
          hasBody: !!execSummaryResponse?.body,
          hasDirectReports: !!execSummaryResponse?.reports,
          hasResponseData: !!responseData,
          hasReports: !!responseData?.reports,
          reportCount: responseData?.reports?.length || 0,
          responseKeys: Object.keys(execSummaryResponse || {})
        });

        const report = responseData?.reports?.[0];
        
        if (report && report.rows) {
          structuredLogger.info('Processing Executive Summary report', {
            component: 'xero-report-fetcher',
            rowCount: report.rows.length,
            reportDate: report.reportDate,
            reportName: report.reportName
          });
          // Initialize cash flow summary
          const summary: CashFlowSummary = {
            cashAtStart: 0,
            cashAtEnd: 0,
            netCashFlow: 0,
            operatingActivities: 0,
            investingActivities: 0,
            financingActivities: 0,
            period: fromDate && toDate ? 
              `${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}` : 
              'Current Period',
            periodStart: fromDate?.toISOString().split('T')[0] || '',
            periodEnd: toDate?.toISOString().split('T')[0] || ''
          };

          // Helper function to extract value from cells
          const extractValue = (cells: any[]): number => {
            if (!cells || cells.length < 2) return 0;
            const value = cells[1]?.value;
            if (value !== undefined && value !== null && value !== '') {
              const valueStr = value.toString();
              const isNegative = valueStr.includes('(') && valueStr.includes(')');
              const cleanValue = valueStr.replace(/[$£€,()]/g, '').trim();
              const num = parseFloat(cleanValue);
              if (isNaN(num)) return 0;
              return isNegative ? -num : num;
            }
            return 0;
          };

          // Parse Executive Summary sections
          const sectionTitles: string[] = [];
          report.rows.forEach((section: any) => {
            if (section.rowType === 'Section' && section.rows) {
              const sectionTitle = (section.title || '').toLowerCase();
              sectionTitles.push(sectionTitle || 'untitled');
              
              // Look for Cash section
              if (sectionTitle === 'cash') {
                structuredLogger.info('Found Cash section in Executive Summary', {
                  component: 'xero-report-fetcher',
                  rowCount: section.rows.length
                });
                section.rows.forEach((row: any) => {
                  if (row.cells && row.cells.length >= 2) {
                    const label = (row.cells[0]?.value || '').toLowerCase();
                    const value = extractValue(row.cells);
                    
                    if (label.includes('cash received')) {
                      // Cash received represents operating activities (positive)
                      summary.operatingActivities += value;
                    } else if (label.includes('cash spent')) {
                      // Cash spent represents operating activities (negative)
                      summary.operatingActivities -= value;
                    } else if (label.includes('foreign currency')) {
                      // Foreign currency gains/losses affect operating activities
                      summary.operatingActivities += value;
                    } else if (label.includes('cash surplus') || label.includes('cash deficit')) {
                      // This is the net cash flow
                      summary.netCashFlow = value;
                    } else if (label.includes('closing bank balance')) {
                      summary.cashAtEnd = value;
                    } else if (label.includes('opening bank balance')) {
                      summary.cashAtStart = value;
                    }
                  }
                });
              }
            }
          });
          
          structuredLogger.info('Executive Summary sections found', {
            component: 'xero-report-fetcher',
            sections: sectionTitles,
            cashFlowData: {
              cashAtStart: summary.cashAtStart,
              cashAtEnd: summary.cashAtEnd,
              netCashFlow: summary.netCashFlow,
              operatingActivities: summary.operatingActivities
            }
          });
          
          // If we didn't find opening balance, calculate it
          if (summary.cashAtStart === 0 && summary.cashAtEnd !== 0 && summary.netCashFlow !== 0) {
            summary.cashAtStart = summary.cashAtEnd - summary.netCashFlow;
          }
          
          // If net cash flow wasn't explicitly found, calculate it
          if (summary.netCashFlow === 0) {
            summary.netCashFlow = summary.cashAtEnd - summary.cashAtStart;
          }

          structuredLogger.info('Cash flow summary from Executive Summary', {
            component: 'xero-report-fetcher',
            tenantId,
            summary,
            source: 'executive_summary'
          });

          return summary;
        }
      } catch (execError: any) {
        structuredLogger.warn('Executive Summary failed, trying Finance API', {
          component: 'xero-report-fetcher',
          error: execError?.message || 'Unknown error',
          errorType: execError?.constructor?.name,
          errorCode: execError?.statusCode || execError?.response?.statusCode,
          errorStack: execError?.stack
        });
      }

      // Check if Finance API is available
      const financeApi = (xeroClient as any).financeApi;
      
      if (financeApi && typeof financeApi.getFinancialStatementCashflow === 'function') {
        // Use Finance API for cash flow data
        try {
          const formatDate = (date: Date | undefined) => {
            if (!date) return undefined;
            return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
          };

          const response = await executeXeroAPICall<any>(
            xeroClient,
            tenantId,
            (client) => (client as any).financeApi.getFinancialStatementCashflow(
              tenantId,
              formatDate(fromDate),
              formatDate(toDate)
            )
          );

          const cashFlowData = response?.body;
          
          // Initialize cash flow summary
          const summary: CashFlowSummary = {
            cashAtStart: 0,
            cashAtEnd: 0,
            netCashFlow: 0,
            operatingActivities: 0,
            investingActivities: 0,
            financingActivities: 0,
            period: fromDate && toDate ? 
              `${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}` : 
              'Current Period',
            periodStart: fromDate?.toISOString().split('T')[0] || '',
            periodEnd: toDate?.toISOString().split('T')[0] || ''
          };

          // Parse Finance API cash flow response
          if (cashFlowData) {
            // The Finance API returns a CashflowResponse with structured data
            // Extract cash flow activities
            if (cashFlowData.cashflowActivities) {
              const activities = cashFlowData.cashflowActivities;
              
              // Operating activities
              if (activities.operatingActivities) {
                summary.operatingActivities = activities.operatingActivities.total || 0;
              }
              
              // Investing activities
              if (activities.investingActivities) {
                summary.investingActivities = activities.investingActivities.total || 0;
              }
              
              // Financing activities
              if (activities.financingActivities) {
                summary.financingActivities = activities.financingActivities.total || 0;
              }
            }
            
            // Opening and closing balances
            if (cashFlowData.openingCashBalance !== undefined) {
              summary.cashAtStart = cashFlowData.openingCashBalance;
            }
            
            if (cashFlowData.closingCashBalance !== undefined) {
              summary.cashAtEnd = cashFlowData.closingCashBalance;
            }
            
            // Net cash flow calculation
            summary.netCashFlow = summary.operatingActivities + 
                                 summary.investingActivities + 
                                 summary.financingActivities;
            
            // Verify the calculation matches the reported closing balance
            const calculatedClosing = summary.cashAtStart + summary.netCashFlow;
            if (Math.abs(calculatedClosing - summary.cashAtEnd) > 0.01) {
              structuredLogger.warn('Cash flow calculation mismatch', {
                component: 'xero-report-fetcher',
                calculated: calculatedClosing,
                reported: summary.cashAtEnd,
                difference: calculatedClosing - summary.cashAtEnd
              });
            }
          }

          structuredLogger.info('Cash flow summary from Finance API', {
            component: 'xero-report-fetcher',
            tenantId,
            summary,
            hasData: cashFlowData !== null
          });

          return summary;
          
        } catch (financeError: any) {
          structuredLogger.warn('Finance API cash flow failed, falling back to bank account method', {
            component: 'xero-report-fetcher',
            error: financeError?.message || 'Unknown error',
            errorCode: financeError?.statusCode || financeError?.response?.statusCode
          });
          // Fall through to bank account method
        }
      }

      // Fallback: Calculate cash flow from bank account movements
      structuredLogger.info('Using bank account method for cash flow', {
        component: 'xero-report-fetcher',
        reason: financeApi ? 'Finance API call failed' : 'Finance API not available'
      });

      // Get bank accounts
      const accountsResponse = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => client.accountingApi.getAccounts(
          tenantId,
          undefined,
          'Type=="BANK"'
        )
      );
      
      const bankAccounts = accountsResponse?.body?.accounts || [];
      
      // Initialize summary
      const summary: CashFlowSummary = {
        cashAtStart: 0,
        cashAtEnd: 0,
        netCashFlow: 0,
        operatingActivities: 0,
        investingActivities: 0,
        financingActivities: 0,
        period: fromDate && toDate ? 
          `${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}` : 
          'Current Period',
        periodStart: fromDate?.toISOString().split('T')[0] || '',
        periodEnd: toDate?.toISOString().split('T')[0] || ''
      };
      
      // Calculate total cash from all bank accounts
      let totalCash = 0;
      for (const account of bankAccounts) {
        if (account.status === 'ACTIVE') {
          totalCash += account.balance || 0;
        }
      }
      
      // For bank account method, we can only provide current balance
      summary.cashAtEnd = totalCash;
      
      // If we have date range, try to get transactions to calculate flow
      if (fromDate && toDate && bankAccounts.length > 0) {
        try {
          // Get bank transactions for the period
          const transactionsResponse = await executeXeroAPICall<any>(
            xeroClient,
            tenantId,
            (client) => client.accountingApi.getBankTransactions(
              tenantId,
              undefined,
              `Date>=DateTime(${fromDate.getFullYear()},${fromDate.getMonth() + 1},${fromDate.getDate()})&&Date<=DateTime(${toDate.getFullYear()},${toDate.getMonth() + 1},${toDate.getDate()})`,
              undefined,
              'Date ASC'
            )
          );
          
          const transactions = transactionsResponse?.body?.bankTransactions || [];
          
          // Calculate net cash flow from transactions
          let netFlow = 0;
          for (const transaction of transactions) {
            if (transaction.status === 'AUTHORISED') {
              if (transaction.type === 'RECEIVE') {
                netFlow += transaction.total || 0;
              } else if (transaction.type === 'SPEND') {
                netFlow -= transaction.total || 0;
              }
            }
          }
          
          summary.netCashFlow = netFlow;
          // Estimate starting balance (this is approximate)
          summary.cashAtStart = summary.cashAtEnd - summary.netCashFlow;
          
          // Note: Without detailed categorization, we put all in operating activities
          summary.operatingActivities = netFlow;
          
        } catch (txError) {
          structuredLogger.error('Failed to get bank transactions for cash flow', txError, {
            component: 'xero-report-fetcher',
            tenantId
          });
        }
      }

      structuredLogger.info('Cash flow summary from bank accounts', {
        component: 'xero-report-fetcher',
        tenantId,
        summary,
        accountCount: bankAccounts.length
      });

      return summary;
      
    } catch (error) {
      structuredLogger.error('Failed to fetch cash flow summary', error, {
        component: 'xero-report-fetcher',
        tenantId
      });
      throw error;
    }
  }

  /**
   * Fetch Aged Receivables summary from Xero
   * Aggregates all contacts' aged receivables
   */
  static async fetchAgedReceivablesSummary(tenantId: string): Promise<AgedReceivablesSummary> {
    try {
      const xeroClient = await getXeroClient();
      if (!xeroClient) {
        throw new Error('Xero client not available');
      }

      // Get all contacts first
      const contactsResponse = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => client.accountingApi.getContacts(tenantId)
      );

      const contacts = contactsResponse?.body?.contacts || [];
      
      const summary: AgedReceivablesSummary = {
        totalOutstanding: 0,
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days91Plus: 0,
        contacts: []
      };

      // Fetch aged receivables for each contact with outstanding invoices
      for (const contact of contacts) {
        if (!contact.contactID) continue;

        try {
          // Get aged receivables for this contact
          const agedResponse = await executeXeroAPICall<any>(
            xeroClient,
            tenantId,
            (client) => client.accountingApi.getReportAgedReceivablesByContact(
              tenantId,
              contact.contactID,
              undefined, // date
              undefined, // fromDate
              undefined  // toDate
            )
          );

          const agedReport = agedResponse?.body?.reports?.[0];
          
          if (agedReport && agedReport.rows && agedReport.rows.length > 0) {
            // Parse aged receivables data
            let contactSummary = {
              contactId: contact.contactID,
              contactName: contact.name || '',
              totalOutstanding: 0,
              current: 0,
              days1to30: 0,
              days31to60: 0,
              days61to90: 0,
              days91Plus: 0
            };

            // Extract aging buckets from report
            agedReport.rows.forEach((row: any) => {
              if (row.rowType === 'Row' && row.cells?.length >= 6) {
                contactSummary.current += parseFloat(row.cells[1]?.value || '0');
                contactSummary.days1to30 += parseFloat(row.cells[2]?.value || '0');
                contactSummary.days31to60 += parseFloat(row.cells[3]?.value || '0');
                contactSummary.days61to90 += parseFloat(row.cells[4]?.value || '0');
                contactSummary.days91Plus += parseFloat(row.cells[5]?.value || '0');
              }
            });

            contactSummary.totalOutstanding = contactSummary.current + contactSummary.days1to30 + 
              contactSummary.days31to60 + contactSummary.days61to90 + contactSummary.days91Plus;

            if (contactSummary.totalOutstanding > 0) {
              summary.contacts.push(contactSummary);
              
              // Add to totals
              summary.totalOutstanding += contactSummary.totalOutstanding;
              summary.current += contactSummary.current;
              summary.days1to30 += contactSummary.days1to30;
              summary.days31to60 += contactSummary.days31to60;
              summary.days61to90 += contactSummary.days61to90;
              summary.days91Plus += contactSummary.days91Plus;
            }
          }
        } catch (contactError) {
          // Log error but continue with other contacts
          structuredLogger.warn('Failed to fetch aged receivables for contact', {
            component: 'xero-report-fetcher',
            tenantId,
            contactId: contact.contactID,
            error: contactError instanceof Error ? contactError.message : 'Unknown error'
          });
        }
      }

      structuredLogger.info('Aged receivables summary calculated', {
        component: 'xero-report-fetcher',
        tenantId,
        contactCount: summary.contacts.length,
        totalOutstanding: summary.totalOutstanding
      });

      return summary;
    } catch (error) {
      structuredLogger.error('Failed to fetch aged receivables summary', error, {
        component: 'xero-report-fetcher',
        tenantId
      });
      throw error;
    }
  }

  /**
   * Fetch Aged Payables summary from Xero
   * Aggregates all contacts' aged payables
   */
  static async fetchAgedPayablesSummary(tenantId: string): Promise<AgedPayablesSummary> {
    try {
      const xeroClient = await getXeroClient();
      if (!xeroClient) {
        throw new Error('Xero client not available');
      }

      // Get all contacts first
      const contactsResponse = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => client.accountingApi.getContacts(tenantId)
      );

      const contacts = contactsResponse?.body?.contacts || [];
      
      const summary: AgedPayablesSummary = {
        totalOutstanding: 0,
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days91Plus: 0,
        contacts: []
      };

      // Fetch aged payables for each contact with outstanding bills
      for (const contact of contacts) {
        if (!contact.contactID) continue;

        try {
          // Get aged payables for this contact
          const agedResponse = await executeXeroAPICall<any>(
            xeroClient,
            tenantId,
            (client) => client.accountingApi.getReportAgedPayablesByContact(
              tenantId,
              contact.contactID,
              undefined, // date
              undefined, // fromDate
              undefined  // toDate
            )
          );

          const agedReport = agedResponse?.body?.reports?.[0];
          
          if (agedReport && agedReport.rows && agedReport.rows.length > 0) {
            // Parse aged payables data
            let contactSummary = {
              contactId: contact.contactID,
              contactName: contact.name || '',
              totalOutstanding: 0,
              current: 0,
              days1to30: 0,
              days31to60: 0,
              days61to90: 0,
              days91Plus: 0
            };

            // Extract aging buckets from report
            agedReport.rows.forEach((row: any) => {
              if (row.rowType === 'Row' && row.cells?.length >= 6) {
                contactSummary.current += parseFloat(row.cells[1]?.value || '0');
                contactSummary.days1to30 += parseFloat(row.cells[2]?.value || '0');
                contactSummary.days31to60 += parseFloat(row.cells[3]?.value || '0');
                contactSummary.days61to90 += parseFloat(row.cells[4]?.value || '0');
                contactSummary.days91Plus += parseFloat(row.cells[5]?.value || '0');
              }
            });

            contactSummary.totalOutstanding = contactSummary.current + contactSummary.days1to30 + 
              contactSummary.days31to60 + contactSummary.days61to90 + contactSummary.days91Plus;

            if (contactSummary.totalOutstanding > 0) {
              summary.contacts.push(contactSummary);
              
              // Add to totals
              summary.totalOutstanding += contactSummary.totalOutstanding;
              summary.current += contactSummary.current;
              summary.days1to30 += contactSummary.days1to30;
              summary.days31to60 += contactSummary.days31to60;
              summary.days61to90 += contactSummary.days61to90;
              summary.days91Plus += contactSummary.days91Plus;
            }
          }
        } catch (contactError) {
          // Log error but continue with other contacts
          structuredLogger.warn('Failed to fetch aged payables for contact', {
            component: 'xero-report-fetcher',
            tenantId,
            contactId: contact.contactID,
            error: contactError instanceof Error ? contactError.message : 'Unknown error'
          });
        }
      }

      structuredLogger.info('Aged payables summary calculated', {
        component: 'xero-report-fetcher',
        tenantId,
        contactCount: summary.contacts.length,
        totalOutstanding: summary.totalOutstanding
      });

      return summary;
    } catch (error) {
      structuredLogger.error('Failed to fetch aged payables summary', error, {
        component: 'xero-report-fetcher',
        tenantId
      });
      throw error;
    }
  }

  /**
   * Fetch detailed Balance Sheet with all account-level data
   */
  static async fetchDetailedBalanceSheet(tenantId: string, asAtDate?: Date): Promise<DetailedBalanceSheet> {
    try {
      const xeroClient = await getXeroClient();
      if (!xeroClient) {
        throw new Error('Xero client not available');
      }
      
      // Use June 30, 2025 as the target date if not specified
      const targetDate = asAtDate || new Date('2025-06-30');
      
      structuredLogger.info('[XeroReportFetcher] Fetching detailed Balance Sheet', {
        component: 'xero-report-fetcher',
        targetDate: targetDate.toISOString().split('T')[0]
      });
      
      // Fetch the actual Balance Sheet report
      const balanceSheetResponse = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => client.accountingApi.getReportBalanceSheet(
          tenantId,
          targetDate.toISOString().split('T')[0],
          3, // periods
          'MONTH' // timeframe
        )
      );
      
      const report = balanceSheetResponse?.body?.reports?.[0] || balanceSheetResponse?.reports?.[0];
      
      if (!report || !report.rows) {
        throw new Error('No balance sheet data found');
      }
      
      // Log report structure for debugging
      structuredLogger.info('[XeroReportFetcher] Balance sheet report structure', {
        component: 'xero-report-fetcher',
        reportName: report.reportName,
        reportDate: report.reportDate,
        sectionCount: report.rows?.length || 0,
        sections: report.rows?.map((section: any) => ({
          type: section.rowType,
          title: section.title,
          rowCount: section.rows?.length || 0
        }))
      });
      
      // Write to development log
      try {
        const fs = require('fs');
        fs.appendFileSync('development.log', 
          `\n=== XERO DETAILED BALANCE SHEET ${new Date().toISOString()} ===\n` +
          `Target Date: ${targetDate.toISOString().split('T')[0]}\n` +
          `Sections: ${JSON.stringify(report.rows?.map((s: any) => ({ title: s.title, type: s.rowType, rows: s.rows?.length })), null, 2)}\n`
        );
      } catch (logError) {
        // Silent fail
      }
      
      // Initialize the detailed balance sheet structure
      const detailedBalanceSheet: DetailedBalanceSheet = {
        assets: {
          currentAssets: [],
          nonCurrentAssets: [],
          totalAssets: 0
        },
        liabilities: {
          currentLiabilities: [],
          nonCurrentLiabilities: [],
          totalLiabilities: 0
        },
        equity: {
          accounts: [],
          totalEquity: 0
        },
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        netAssets: 0,
        reportDate: targetDate.toISOString().split('T')[0],
        source: 'xero_direct',
        fetchedAt: new Date().toISOString()
      };
      
      // Find the correct column index for our target date
      let targetColumnIndex = -1;
      const headerRow = report.rows?.find((row: any) => row.rowType === 'Header');
      if (headerRow && headerRow.cells) {
        headerRow.cells.forEach((cell: any, index: number) => {
          const cellValue = cell?.value || '';
          if (cellValue.includes('30 Jun 2025')) {
            targetColumnIndex = index;
          }
        });
      }
      
      if (targetColumnIndex === -1) {
        targetColumnIndex = 1; // Default to first data column
      }
      
      // Helper function to extract value from row
      const extractValue = (row: any): number => {
        if (!row.cells || row.cells.length <= targetColumnIndex) return 0;
        const value = row.cells[targetColumnIndex]?.value;
        if (value && value !== '') {
          const num = parseFloat(value.toString().replace(/,/g, ''));
          return isNaN(num) ? 0 : num;
        }
        return 0;
      };
      
      // Helper function to process accounts within a section
      const processAccounts = (rows: any[], sectionType: string): BalanceSheetAccount[] => {
        const accounts: BalanceSheetAccount[] = [];
        
        rows.forEach((row: any) => {
          if (!row.cells || row.cells.length < 2) return;
          
          const accountName = row.cells[0]?.value || '';
          const value = extractValue(row);
          
          // Skip empty rows or total rows
          if (!accountName || accountName.toLowerCase().includes('total')) {
            return;
          }
          
          // Extract account code if present in the name (format: "Code - Name")
          const codeMatch = accountName.match(/^(\d+)\s*-\s*(.+)$/);
          const accountCode = codeMatch ? codeMatch[1] : '';
          const cleanName = codeMatch ? codeMatch[2] : accountName;
          
          accounts.push({
            accountCode,
            accountName: cleanName,
            accountType: sectionType,
            balance: value
          });
        });
        
        return accounts;
      };
      
      // Process each section of the report
      report.rows.forEach((section: any) => {
        if (section.rowType === 'Section' && section.rows) {
          const sectionTitle = section.title || '';
          const sectionLower = sectionTitle.toLowerCase();
          
          structuredLogger.info('[XeroReportFetcher] Processing section', {
            component: 'xero-report-fetcher',
            sectionTitle,
            rowCount: section.rows?.length || 0
          });
          
          // Process based on section type - more flexible matching
          if (sectionLower.includes('bank') || sectionLower.includes('current asset')) {
            // This is likely current assets
            const accounts = processAccounts(section.rows, 'Current Asset');
            detailedBalanceSheet.assets.currentAssets.push(...accounts);
            
            // Find total for this section
            section.rows.forEach((row: any) => {
              const label = row.cells?.[0]?.value || '';
              if (label.toLowerCase().includes('total') && 
                  (label.toLowerCase().includes('current asset') || label.toLowerCase().includes('bank'))) {
                const total = extractValue(row);
                detailedBalanceSheet.currentAssets = total;
              }
            });
          } else if (sectionLower.includes('non-current asset') || 
                     sectionLower.includes('non current asset') ||
                     sectionLower.includes('fixed asset') ||
                     sectionLower.includes('property')) {
            const accounts = processAccounts(section.rows, 'Non-Current Asset');
            detailedBalanceSheet.assets.nonCurrentAssets.push(...accounts);
            
            // Find total for this section
            section.rows.forEach((row: any) => {
              const label = row.cells?.[0]?.value || '';
              if (label.toLowerCase().includes('total')) {
                const total = extractValue(row);
                detailedBalanceSheet.nonCurrentAssets = total;
              }
            });
          } else if (sectionLower.includes('current liabilit')) {
            const accounts = processAccounts(section.rows, 'Current Liability');
            detailedBalanceSheet.liabilities.currentLiabilities.push(...accounts);
            
            // Find total for this section
            section.rows.forEach((row: any) => {
              const label = row.cells?.[0]?.value || '';
              if (label.toLowerCase().includes('total') && label.toLowerCase().includes('current')) {
                const total = Math.abs(extractValue(row));
                detailedBalanceSheet.currentLiabilities = total;
              }
            });
          } else if (sectionLower.includes('non-current liabilit') || 
                     sectionLower.includes('non current liabilit') ||
                     sectionLower.includes('term liabilit') ||
                     sectionLower.includes('long term')) {
            const accounts = processAccounts(section.rows, 'Non-Current Liability');
            detailedBalanceSheet.liabilities.nonCurrentLiabilities.push(...accounts);
            
            // Find total for this section
            section.rows.forEach((row: any) => {
              const label = row.cells?.[0]?.value || '';
              if (label.toLowerCase().includes('total')) {
                const total = Math.abs(extractValue(row));
                detailedBalanceSheet.nonCurrentLiabilities = total;
              }
            });
          } else if (sectionLower.includes('equity')) {
            const accounts = processAccounts(section.rows, 'Equity');
            detailedBalanceSheet.equity.accounts.push(...accounts);
          } else if (sectionTitle === '') {
            // This might be a root-level section with assets/liabilities
            // Process all rows and categorize them
            section.rows.forEach((row: any) => {
              if (row.rowType === 'Section' && row.rows) {
                // Recursively process subsections
                const subSectionTitle = row.title || '';
                const subSectionLower = subSectionTitle.toLowerCase();
                
                if (subSectionLower.includes('asset')) {
                  const accounts = processAccounts(row.rows, 
                    subSectionLower.includes('current') ? 'Current Asset' : 'Non-Current Asset');
                  if (subSectionLower.includes('current')) {
                    detailedBalanceSheet.assets.currentAssets.push(...accounts);
                  } else {
                    detailedBalanceSheet.assets.nonCurrentAssets.push(...accounts);
                  }
                } else if (subSectionLower.includes('liabilit')) {
                  const accounts = processAccounts(row.rows, 
                    subSectionLower.includes('current') ? 'Current Liability' : 'Non-Current Liability');
                  if (subSectionLower.includes('current')) {
                    detailedBalanceSheet.liabilities.currentLiabilities.push(...accounts);
                  } else {
                    detailedBalanceSheet.liabilities.nonCurrentLiabilities.push(...accounts);
                  }
                } else if (subSectionLower.includes('equity')) {
                  const accounts = processAccounts(row.rows, 'Equity');
                  detailedBalanceSheet.equity.accounts.push(...accounts);
                }
              }
            });
          }
          
          // Look for totals
          section.rows.forEach((row: any) => {
            const label = row.cells?.[0]?.value || '';
            const labelLower = label.toLowerCase();
            const value = extractValue(row);
            
            if (labelLower === 'total assets' || 
                (labelLower === 'assets' && sectionLower === '')) {
              detailedBalanceSheet.totalAssets = value;
              detailedBalanceSheet.assets.totalAssets = value;
            } else if (labelLower === 'total liabilities' || 
                       (labelLower === 'liabilities' && sectionLower === '')) {
              detailedBalanceSheet.totalLiabilities = Math.abs(value);
              detailedBalanceSheet.liabilities.totalLiabilities = Math.abs(value);
            } else if (labelLower === 'total equity' || 
                       (labelLower === 'equity' && sectionLower === '')) {
              detailedBalanceSheet.totalEquity = value;
              detailedBalanceSheet.equity.totalEquity = value;
            }
          });
        }
      });
      
      // Calculate derived values
      detailedBalanceSheet.netAssets = detailedBalanceSheet.totalAssets - detailedBalanceSheet.totalLiabilities;
      
      // Calculate current assets/liabilities if not already set
      if (!detailedBalanceSheet.currentAssets) {
        detailedBalanceSheet.currentAssets = detailedBalanceSheet.assets.currentAssets
          .reduce((sum, acc) => sum + acc.balance, 0);
      }
      if (!detailedBalanceSheet.currentLiabilities) {
        detailedBalanceSheet.currentLiabilities = detailedBalanceSheet.liabilities.currentLiabilities
          .reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
      }
      if (!detailedBalanceSheet.nonCurrentAssets) {
        detailedBalanceSheet.nonCurrentAssets = detailedBalanceSheet.assets.nonCurrentAssets
          .reduce((sum, acc) => sum + acc.balance, 0);
      }
      if (!detailedBalanceSheet.nonCurrentLiabilities) {
        detailedBalanceSheet.nonCurrentLiabilities = detailedBalanceSheet.liabilities.nonCurrentLiabilities
          .reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
      }
      
      // Calculate financial ratios
      detailedBalanceSheet.workingCapital = detailedBalanceSheet.currentAssets - detailedBalanceSheet.currentLiabilities;
      detailedBalanceSheet.currentRatio = detailedBalanceSheet.currentLiabilities > 0 
        ? detailedBalanceSheet.currentAssets / detailedBalanceSheet.currentLiabilities 
        : 0;
      
      // Calculate quick ratio (excluding inventory)
      const quickAssets = detailedBalanceSheet.currentAssets;
      detailedBalanceSheet.quickRatio = detailedBalanceSheet.currentLiabilities > 0 
        ? quickAssets / detailedBalanceSheet.currentLiabilities 
        : 0;
      
      detailedBalanceSheet.debtToEquityRatio = detailedBalanceSheet.totalEquity > 0 
        ? detailedBalanceSheet.totalLiabilities / detailedBalanceSheet.totalEquity 
        : 0;
      
      detailedBalanceSheet.equityRatio = detailedBalanceSheet.totalAssets > 0 
        ? detailedBalanceSheet.totalEquity / detailedBalanceSheet.totalAssets 
        : 0;
      
      // Add summary object
      detailedBalanceSheet.summary = {
        netAssets: detailedBalanceSheet.netAssets,
        currentRatio: detailedBalanceSheet.currentRatio,
        quickRatio: detailedBalanceSheet.quickRatio,
        debtToEquityRatio: detailedBalanceSheet.debtToEquityRatio,
        equityRatio: detailedBalanceSheet.equityRatio
      };
      
      structuredLogger.info('[XeroReportFetcher] Detailed balance sheet fetched successfully', {
        component: 'xero-report-fetcher',
        totalAssets: detailedBalanceSheet.totalAssets,
        totalLiabilities: detailedBalanceSheet.totalLiabilities,
        totalEquity: detailedBalanceSheet.totalEquity,
        currentAssetsCount: detailedBalanceSheet.assets.currentAssets.length,
        nonCurrentAssetsCount: detailedBalanceSheet.assets.nonCurrentAssets.length,
        currentLiabilitiesCount: detailedBalanceSheet.liabilities.currentLiabilities.length,
        nonCurrentLiabilitiesCount: detailedBalanceSheet.liabilities.nonCurrentLiabilities.length,
        equityAccountsCount: detailedBalanceSheet.equity.accounts.length
      });
      
      return detailedBalanceSheet;
    } catch (error) {
      structuredLogger.error('[XeroReportFetcher] Failed to fetch detailed balance sheet', error, {
        component: 'xero-report-fetcher',
        tenantId
      });
      throw error;
    }
  }

}