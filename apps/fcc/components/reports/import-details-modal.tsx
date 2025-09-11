'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, Loader2, AlertCircle, FileText, Calendar, Database } from 'lucide-react';
import { format } from 'date-fns';
import { formatNumber, formatCurrency } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

interface ImportDetailsModalProps {
  importId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ImportDetails {
  id: string;
  reportType: string;
  source: string;
  periodStart: string;
  periodEnd: string;
  importedAt: string;
  importedBy: string;
  fileName?: string;
  fileSize?: number;
  status: string;
  recordCount: number;
  processedData?: any;
  rawData?: any;
  metadata?: any;
}

export function ImportDetailsModal({ importId, isOpen, onClose }: ImportDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importDetails, setImportDetails] = useState<ImportDetails | null>(null);
  const [viewMode, setViewMode] = useState<'processed' | 'raw'>('processed');

  useEffect(() => {
    if (isOpen && importId) {
      fetchImportDetails();
    }
  }, [isOpen, importId]);

  const fetchImportDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/v1/reports/import-details/${importId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch import details');
      }
      
      const data = await response.json();
      setImportDetails(data);
      
      // Log to console for debugging
      console.log('[Import Details Modal] Fetched import details', {
        importId,
        reportType: data.reportType,
        hasProcessedData: !!data.processedData,
        hasRawData: !!data.rawData,
        processedDataStructure: data.processedData ? Object.keys(data.processedData) : null,
        rawDataStructure: data.rawData ? Object.keys(data.rawData) : null
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load import details';
      setError(errorMessage);
      console.error('[Import Details Modal] Error fetching details', { error: err, importId });
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    if (!importDetails) return;
    
    const dataToExport = viewMode === 'processed' ? importDetails.processedData : importDetails.rawData;
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${importDetails.reportType.toLowerCase()}-${viewMode}-${importId}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const renderBalanceSheetData = (data: any) => {
    if (!data) return null;

    // Handle different data structures - sometimes it's nested, sometimes it's flat
    const totalAssets = data.summary?.totalAssets || data.totalAssets || data.assets?.total || 0;
    const totalLiabilities = data.summary?.totalLiabilities || data.totalLiabilities || data.liabilities?.total || 0;
    const totalEquity = data.summary?.totalEquity || data.totalEquity || data.equity?.total || 0;
    const netAssets = data.summary?.netAssets || data.netAssets || (totalAssets - totalLiabilities) || 0;

    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Summary</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">Total Assets</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(totalAssets)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Liabilities</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(totalLiabilities)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Net Assets</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(netAssets)}</p>
            </div>
          </div>
        </div>

        {/* Assets */}
        {(data.assets || data.currentAssets || data.nonCurrentAssets) && (
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3">Assets</h4>
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Account</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {/* Current Assets */}
                  {(data.assets?.currentAssets || data.currentAssets) && (
                    <>
                      <tr className="bg-gray-900/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-300">Current Assets</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-300">
                          {formatCurrency(data.currentAssets || 0)}
                        </td>
                      </tr>
                      {(data.assets?.currentAssets || []).map((account: any, index: number) => (
                        <tr key={`current-${index}`}>
                          <td className="px-4 py-3 pl-8 text-sm text-white">{account.accountName || account.name}</td>
                          <td className="px-4 py-3 text-sm text-right text-white">
                            {formatCurrency(account.balance || 0)}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                  {/* Non-Current Assets */}
                  {(data.assets?.nonCurrentAssets || data.nonCurrentAssets) && (
                    <>
                      <tr className="bg-gray-900/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-300">Fixed Assets</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-300">
                          {formatCurrency(data.nonCurrentAssets || 0)}
                        </td>
                      </tr>
                      {(data.assets?.nonCurrentAssets || []).map((account: any, index: number) => (
                        <tr key={`noncurrent-${index}`}>
                          <td className="px-4 py-3 pl-8 text-sm text-white">{account.accountName || account.name}</td>
                          <td className="px-4 py-3 text-sm text-right text-white">
                            {formatCurrency(account.balance || 0)}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                  {/* Total Assets Row */}
                  <tr className="bg-gray-900 font-medium">
                    <td className="px-4 py-3 text-sm text-white">Total Assets</td>
                    <td className="px-4 py-3 text-sm text-right text-white">
                      {formatCurrency(data.assets?.totalAssets || data.totalAssets || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Liabilities */}
        {(data.liabilities || data.currentLiabilities !== undefined || data.nonCurrentLiabilities !== undefined) && (
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3">Liabilities</h4>
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Account</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {/* Current Liabilities */}
                  {(data.liabilities?.currentLiabilities || data.currentLiabilities !== undefined) && (
                    <>
                      <tr className="bg-gray-900/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-300">Current Liabilities</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-300">
                          {formatCurrency(data.currentLiabilities || 0)}
                        </td>
                      </tr>
                      {(data.liabilities?.currentLiabilities || []).map((account: any, index: number) => (
                        <tr key={`current-${index}`}>
                          <td className="px-4 py-3 pl-8 text-sm text-white">{account.accountName || account.name}</td>
                          <td className="px-4 py-3 text-sm text-right text-white">
                            {formatCurrency(account.balance || 0)}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                  {/* Non-Current Liabilities */}
                  {(data.liabilities?.nonCurrentLiabilities || data.nonCurrentLiabilities !== undefined) && data.nonCurrentLiabilities > 0 && (
                    <>
                      <tr className="bg-gray-900/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-300">Non-Current Liabilities</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-300">
                          {formatCurrency(data.nonCurrentLiabilities || 0)}
                        </td>
                      </tr>
                      {(data.liabilities?.nonCurrentLiabilities || []).map((account: any, index: number) => (
                        <tr key={`noncurrent-${index}`}>
                          <td className="px-4 py-3 pl-8 text-sm text-white">{account.accountName || account.name}</td>
                          <td className="px-4 py-3 text-sm text-right text-white">
                            {formatCurrency(account.balance || 0)}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                  {/* Total Liabilities Row */}
                  <tr className="bg-gray-900 font-medium">
                    <td className="px-4 py-3 text-sm text-white">Total Liabilities</td>
                    <td className="px-4 py-3 text-sm text-right text-white">
                      {formatCurrency(data.liabilities?.totalLiabilities || data.totalLiabilities || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Equity */}
        {data.equity && (
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3">Equity</h4>
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Account</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {data.equity?.accounts && data.equity.accounts.length > 0 && (
                    data.equity.accounts.map((account: any, index: number) => (
                      <tr key={`equity-${index}`}>
                        <td className="px-4 py-3 text-sm text-white">{account.accountName || account.name || `Equity Account ${index + 1}`}</td>
                        <td className="px-4 py-3 text-sm text-right text-white">
                          {formatCurrency(account.balance || account.amount || 0)}
                        </td>
                      </tr>
                    ))
                  )}
                  {/* Total Equity Row */}
                  <tr className="bg-gray-900 font-medium">
                    <td className="px-4 py-3 text-sm text-white">Total Equity</td>
                    <td className="px-4 py-3 text-sm text-right text-white">
                      {formatCurrency(data.equity?.total || data.totalEquity || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };


  const renderProfitLossData = (data: any) => {
    if (!data) return null;

    // Debug logging
    console.log('[Import Details Modal] Rendering Profit & Loss data:', {
      dataKeys: Object.keys(data),
      hasRevenue: !!data.revenue,
      hasExpenses: !!data.expenses,
      totalRevenue: data.totalRevenue,
      totalExpenses: data.totalExpenses,
      revenueArray: data.revenue,
      expensesArray: data.expenses,
      fullData: data
    });

    // Check if this is the simple summary format from XeroReportFetcher
    const isSimpleSummary = 'totalRevenue' in data && 'totalExpenses' in data && 'netProfit' in data && !data.revenue && !data.expenses;
    
    // Check if all values are zero
    const allZeros = data.totalRevenue === 0 && data.totalExpenses === 0 && 
                    data.netProfit === 0 && data.grossProfit === 0;

    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Summary</h4>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Total Revenue</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(data.totalRevenue || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Expenses</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(data.totalExpenses || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Net Profit</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(data.netProfit || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Margin</p>
              <p className="text-lg font-semibold text-white">
                {data.totalRevenue ? ((data.netProfit / data.totalRevenue) * 100).toFixed(1) : '0'}%
              </p>
            </div>
          </div>
        </div>
        
        {/* Warning message if all zeros */}
        {allZeros && (
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-400">No Transaction Data</p>
                <p className="text-sm text-gray-400 mt-1">
                  This report shows zero values. This typically means:
                </p>
                <ul className="text-sm text-gray-400 mt-2 list-disc list-inside space-y-1">
                  <li>No transactions exist in Xero for this period</li>
                  <li>Transactions haven't been reconciled or approved</li>
                  <li>The selected date range has no activity</li>
                </ul>
                <p className="text-sm text-gray-400 mt-3">
                  Try selecting a different date range or check your Xero account.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Additional summary details if available */}
        {(data.grossProfit !== undefined || data.operatingExpenses !== undefined || data.otherIncome !== undefined || data.otherExpenses !== undefined) && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Breakdown</h4>
            <div className="grid grid-cols-2 gap-4">
              {data.grossProfit !== undefined && (
                <div>
                  <p className="text-xs text-gray-500">Gross Profit</p>
                  <p className="text-lg font-semibold text-white">{formatCurrency(data.grossProfit)}</p>
                </div>
              )}
              {(data.totalOperatingExpenses !== undefined || data.operatingExpenses !== undefined) && (
                <div>
                  <p className="text-xs text-gray-500">Operating Expenses</p>
                  <p className="text-lg font-semibold text-white">
                    {formatCurrency(
                      data.totalOperatingExpenses ?? 
                      (typeof data.operatingExpenses === 'number' ? data.operatingExpenses : 
                       data.operatingExpenses?.totalOperatingExpenses ?? 
                       data.operatingExpenses?.total ?? 0)
                    )}
                  </p>
                </div>
              )}
              {(data.totalOtherIncome !== undefined || data.otherIncome !== undefined) && (
                <div>
                  <p className="text-xs text-gray-500">Other Income</p>
                  <p className="text-lg font-semibold text-green-400">
                    {formatCurrency(
                      data.totalOtherIncome ?? 
                      (typeof data.otherIncome === 'number' ? data.otherIncome : 
                       data.otherIncome?.totalOtherIncome ?? 
                       data.otherIncome?.total ?? 0)
                    )}
                  </p>
                </div>
              )}
              {(data.totalOtherExpenses !== undefined || data.otherExpenses !== undefined) && (
                <div>
                  <p className="text-xs text-gray-500">Other Expenses</p>
                  <p className="text-lg font-semibold text-red-400">
                    {formatCurrency(
                      data.totalOtherExpenses ?? 
                      (typeof data.otherExpenses === 'number' ? data.otherExpenses : 
                       data.otherExpenses?.totalOtherExpenses ?? 
                       data.otherExpenses?.total ?? 0)
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Detailed Revenue & Expenses if available */}
        {(data.revenue || data.expenses) && (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {data.revenue && Array.isArray(data.revenue) && data.revenue.map((revSection: any, index: number) => (
                  <React.Fragment key={`revenue-${index}`}>
                    <tr className="bg-gray-900/50">
                      <td className="px-4 py-3 text-sm font-semibold text-white">
                        {revSection.accountName || 'Revenue'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-green-400">
                        {formatCurrency(revSection.total || 0)}
                      </td>
                    </tr>
                    {revSection.lineItems && Array.isArray(revSection.lineItems) && revSection.lineItems.map((item: any, itemIndex: number) => (
                      <tr key={`revenue-${index}-item-${itemIndex}`}>
                        <td className="px-4 py-3 pl-8 text-sm text-gray-300">{item.accountName}</td>
                        <td className="px-4 py-3 text-sm text-right text-white">
                          {formatCurrency(item.amount || 0)}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                {data.expenses && Array.isArray(data.expenses) && data.expenses.map((expSection: any, index: number) => (
                  <React.Fragment key={`expense-${index}`}>
                    <tr className="bg-gray-900/50">
                      <td className="px-4 py-3 text-sm font-semibold text-white">
                        {expSection.accountName || 'Expenses'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-red-400">
                        {formatCurrency(expSection.total || 0)}
                      </td>
                    </tr>
                    {expSection.lineItems && Array.isArray(expSection.lineItems) && expSection.lineItems.map((item: any, itemIndex: number) => (
                      <tr key={`expense-${index}-item-${itemIndex}`}>
                        <td className="px-4 py-3 pl-8 text-sm text-gray-300">{item.accountName}</td>
                        <td className="px-4 py-3 text-sm text-right text-white">
                          {formatCurrency(item.amount || 0)}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderPLSection = (title: string, section: any, colorClass: string): JSX.Element[] => {
    const rows: JSX.Element[] = [];
    
    rows.push(
      <tr key={title} className="bg-gray-900/50">
        <td className="px-4 py-3 text-sm font-semibold text-white">{title}</td>
        <td className={cn("px-4 py-3 text-sm text-right font-semibold", colorClass)}>
          {formatCurrency(section.total || 0)}
        </td>
      </tr>
    );
    
    if (section.categories && Array.isArray(section.categories)) {
      section.categories.forEach((category: any, index: number) => {
        rows.push(
          <tr key={`${title}-cat-${index}`}>
            <td className="px-4 py-3 pl-8 text-sm text-gray-300">{category.name}</td>
            <td className="px-4 py-3 text-sm text-right text-white">
              {formatCurrency(category.amount || 0)}
            </td>
          </tr>
        );
        
        if (category.accounts && Array.isArray(category.accounts)) {
          category.accounts.forEach((account: any, accountIndex: number) => {
            rows.push(
              <tr key={`${title}-cat-${index}-acc-${accountIndex}`}>
                <td className="px-4 py-3 pl-12 text-sm text-gray-400">{account.name}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-400">
                  {formatCurrency(account.amount || 0)}
                </td>
              </tr>
            );
          });
        }
      });
    }
    
    return rows;
  };

  const renderPLDetailSection = (title: string, section: any, colorClass: string = ''): JSX.Element[] => {
    const rows: JSX.Element[] = [];
    
    if (!section) return rows;
    
    // Section header with total
    rows.push(
      <tr key={`section-${title}`} className="bg-gray-900/50">
        <td className="px-4 py-3 text-sm font-semibold text-white">{title}</td>
        <td className={cn("px-4 py-3 text-sm text-right font-semibold", colorClass || "text-white")}>
          {formatCurrency(section.total || 0)}
        </td>
      </tr>
    );
    
    // Individual accounts
    if (section.accounts && Array.isArray(section.accounts)) {
      section.accounts.forEach((account: any, index: number) => {
        rows.push(
          <tr key={`${title}-account-${index}`}>
            <td className="px-4 py-3 pl-8 text-sm text-gray-300">{account.name}</td>
            <td className="px-4 py-3 text-sm text-right text-white">
              {formatCurrency(account.amount || 0)}
            </td>
          </tr>
        );
      });
    }
    
    return rows;
  };

  const renderTrialBalanceData = (data: any) => {
    if (!data) return null;

    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Summary</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">Total Debits</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(data.totalDebits || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Credits</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(data.totalCredits || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Balance</p>
              <p className={cn(
                "text-lg font-semibold",
                data.isBalanced ? "text-green-400" : "text-red-400"
              )}>
                {data.isBalanced ? 'Balanced' : formatCurrency(Math.abs((data.totalDebits || 0) - (data.totalCredits || 0)))}
              </p>
            </div>
          </div>
        </div>

        {/* Accounts */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Account</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">Debit</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">Credit</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">YTD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {data.accounts && data.accounts.map((account: any, index: number) => (
                <tr key={index}>
                  <td className="px-4 py-3 text-sm text-white">{account.accountName}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{account.accountType}</td>
                  <td className="px-4 py-3 text-sm text-right text-white">
                    {account.debit ? formatCurrency(account.debit) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-white">
                    {account.credit ? formatCurrency(account.credit) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-white">
                    {formatCurrency(account.ytd || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCashFlowData = (data: any) => {
    if (!data) return null;

    // Check if this is the new Cash Flow Statement format
    const isCashFlowStatement = data.operatingActivities && data.investingActivities && data.financingActivities;
    
    if (isCashFlowStatement) {
      // Render the proper Cash Flow Statement
      return (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Cash Flow Summary</h4>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Opening Balance</p>
                <p className="text-lg font-semibold text-white">{formatCurrency(data.summary?.openingBalance || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Net Cash Flow</p>
                <p className={cn(
                  "text-lg font-semibold",
                  data.summary?.netCashFlow >= 0 ? "text-green-400" : "text-red-400"
                )}>
                  {formatCurrency(data.summary?.netCashFlow || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Closing Balance</p>
                <p className="text-lg font-semibold text-white">{formatCurrency(data.summary?.closingBalance || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Operating Ratio</p>
                <p className="text-lg font-semibold text-white">
                  {data.summary?.operatingCashFlowRatio ? `${data.summary.operatingCashFlowRatio.toFixed(1)}%` : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Operating Activities */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3">Operating Activities</h4>
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <tbody className="divide-y divide-gray-700">
                  {data.operatingActivities.receiptsFromCustomers && (
                    <tr>
                      <td className="px-4 py-3 text-sm text-white">Receipts from Customers</td>
                      <td className="px-4 py-3 text-sm text-right text-green-400">
                        {formatCurrency(data.operatingActivities.receiptsFromCustomers)}
                      </td>
                    </tr>
                  )}
                  {data.operatingActivities.paymentsToSuppliers && (
                    <tr>
                      <td className="px-4 py-3 text-sm text-white">Payments to Suppliers</td>
                      <td className="px-4 py-3 text-sm text-right text-red-400">
                        {formatCurrency(data.operatingActivities.paymentsToSuppliers)}
                      </td>
                    </tr>
                  )}
                  {data.operatingActivities.paymentsToEmployees && (
                    <tr>
                      <td className="px-4 py-3 text-sm text-white">Payments to Employees</td>
                      <td className="px-4 py-3 text-sm text-right text-red-400">
                        {formatCurrency(data.operatingActivities.paymentsToEmployees)}
                      </td>
                    </tr>
                  )}
                  {data.operatingActivities.interestPaid && (
                    <tr>
                      <td className="px-4 py-3 text-sm text-white">Interest Paid</td>
                      <td className="px-4 py-3 text-sm text-right text-red-400">
                        {formatCurrency(data.operatingActivities.interestPaid)}
                      </td>
                    </tr>
                  )}
                  {data.operatingActivities.incomeTaxPaid && (
                    <tr>
                      <td className="px-4 py-3 text-sm text-white">Income Tax Paid</td>
                      <td className="px-4 py-3 text-sm text-right text-red-400">
                        {formatCurrency(data.operatingActivities.incomeTaxPaid)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-gray-900 font-medium">
                    <td className="px-4 py-3 text-sm text-white">Net Cash from Operating Activities</td>
                    <td className={cn(
                      "px-4 py-3 text-sm text-right font-semibold",
                      data.operatingActivities.netCashFromOperating >= 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {formatCurrency(data.operatingActivities.netCashFromOperating)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Investing Activities */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3">Investing Activities</h4>
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <tbody className="divide-y divide-gray-700">
                  {data.investingActivities.purchaseOfAssets && (
                    <tr>
                      <td className="px-4 py-3 text-sm text-white">Purchase of Assets</td>
                      <td className="px-4 py-3 text-sm text-right text-red-400">
                        {formatCurrency(data.investingActivities.purchaseOfAssets)}
                      </td>
                    </tr>
                  )}
                  {data.investingActivities.saleOfAssets && (
                    <tr>
                      <td className="px-4 py-3 text-sm text-white">Sale of Assets</td>
                      <td className="px-4 py-3 text-sm text-right text-green-400">
                        {formatCurrency(data.investingActivities.saleOfAssets)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-gray-900 font-medium">
                    <td className="px-4 py-3 text-sm text-white">Net Cash from Investing Activities</td>
                    <td className={cn(
                      "px-4 py-3 text-sm text-right font-semibold",
                      data.investingActivities.netCashFromInvesting >= 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {formatCurrency(data.investingActivities.netCashFromInvesting)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Financing Activities */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3">Financing Activities</h4>
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <tbody className="divide-y divide-gray-700">
                  {data.financingActivities.proceedsFromBorrowing && (
                    <tr>
                      <td className="px-4 py-3 text-sm text-white">Proceeds from Borrowing</td>
                      <td className="px-4 py-3 text-sm text-right text-green-400">
                        {formatCurrency(data.financingActivities.proceedsFromBorrowing)}
                      </td>
                    </tr>
                  )}
                  {data.financingActivities.repaymentOfBorrowing && (
                    <tr>
                      <td className="px-4 py-3 text-sm text-white">Repayment of Borrowing</td>
                      <td className="px-4 py-3 text-sm text-right text-red-400">
                        {formatCurrency(data.financingActivities.repaymentOfBorrowing)}
                      </td>
                    </tr>
                  )}
                  {data.financingActivities.dividendsPaid && (
                    <tr>
                      <td className="px-4 py-3 text-sm text-white">Dividends Paid</td>
                      <td className="px-4 py-3 text-sm text-right text-red-400">
                        {formatCurrency(data.financingActivities.dividendsPaid)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-gray-900 font-medium">
                    <td className="px-4 py-3 text-sm text-white">Net Cash from Financing Activities</td>
                    <td className={cn(
                      "px-4 py-3 text-sm text-right font-semibold",
                      data.financingActivities.netCashFromFinancing >= 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {formatCurrency(data.financingActivities.netCashFromFinancing)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }
    
    // Fallback to bank summary format for backward compatibility
    const cashSummary = data.detailedCashSummary || data;
    
    if (!cashSummary.accounts || cashSummary.accounts.length === 0) {
      return (
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <p className="text-gray-400">No cash flow data available for this period</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Cash Summary</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">Opening Balance</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(cashSummary.openingBalance || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Movement</p>
              <p className={cn(
                "text-lg font-semibold",
                cashSummary.totalCashMovement >= 0 ? "text-green-400" : "text-red-400"
              )}>
                {formatCurrency(cashSummary.totalCashMovement || 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Closing Balance</p>
              <p className="text-lg font-semibold text-white">{formatCurrency(cashSummary.closingBalance || 0)}</p>
            </div>
          </div>
        </div>

        {/* Bank Account Details */}
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-3">Bank Account Movements</h4>
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Account</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">Opening</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">Received</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">Spent</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">FX Gain</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">Movement</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">Closing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {cashSummary.accounts.map((account: any, index: number) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm text-white">{account.accountName}</td>
                    <td className="px-4 py-3 text-sm text-right text-white">
                      {formatCurrency(account.openingBalance || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-green-400">
                      {formatCurrency(account.cashReceived || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-red-400">
                      {formatCurrency(account.cashSpent || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-400">
                      {formatCurrency(account.fxGain || 0)}
                    </td>
                    <td className={cn(
                      "px-4 py-3 text-sm text-right font-medium",
                      account.netMovement >= 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {formatCurrency(account.netMovement || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-white font-medium">
                      {formatCurrency(account.closingBalance || 0)}
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-gray-900 font-medium">
                  <td className="px-4 py-3 text-sm text-white">Total</td>
                  <td className="px-4 py-3 text-sm text-right text-white">
                    {formatCurrency(cashSummary.openingBalance || 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-green-400">
                    {formatCurrency(cashSummary.accounts.reduce((sum: number, acc: any) => sum + (acc.cashReceived || 0), 0))}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-red-400">
                    {formatCurrency(cashSummary.accounts.reduce((sum: number, acc: any) => sum + (acc.cashSpent || 0), 0))}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-400">
                    {formatCurrency(cashSummary.accounts.reduce((sum: number, acc: any) => sum + (acc.fxGain || 0), 0))}
                  </td>
                  <td className={cn(
                    "px-4 py-3 text-sm text-right font-medium",
                    cashSummary.totalCashMovement >= 0 ? "text-green-400" : "text-red-400"
                  )}>
                    {formatCurrency(cashSummary.totalCashMovement || 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-white font-medium">
                    {formatCurrency(cashSummary.closingBalance || 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderGenericData = (data: any) => {
    if (!data) return null;
    
    // For raw data view, show the JSON structure
    if (viewMode === 'raw') {
      return (
        <div className="bg-gray-800 rounded-lg p-4">
          <pre className="text-sm text-gray-300 overflow-x-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      );
    }
    
    // For processed data, try to render a table if it's an array
    if (Array.isArray(data)) {
      if (data.length === 0) return <p className="text-gray-400">No data available</p>;
      
      const headers = Object.keys(data[0]);
      
      return (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                {headers.map(header => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-medium text-gray-400">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {data.map((row, index) => (
                <tr key={index}>
                  {headers.map(header => (
                    <td key={header} className="px-4 py-3 text-sm text-white">
                      {typeof row[header] === 'object' 
                        ? JSON.stringify(row[header])
                        : String(row[header] || '—')
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    
    // For objects, show as formatted JSON
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <pre className="text-sm text-gray-300 overflow-x-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  };

  const renderReportData = () => {
    if (!importDetails) return null;
    
    // For cash flow reports, always show the cash summary data
    if (importDetails.reportType === 'CASH_FLOW') {
      const data = importDetails.processedData;
      if (!data) {
        return <p className="text-gray-400">No cash flow data available</p>;
      }
      
      if (viewMode === 'raw') {
        // For raw view, show just the detailed cash summary
        const cashSummaryData = data.detailedCashSummary || data;
        return (
          <div className="bg-gray-800 rounded-lg p-4">
            <pre className="text-sm text-gray-300 overflow-x-auto">
              {JSON.stringify(cashSummaryData, null, 2)}
            </pre>
          </div>
        );
      }
      
      // For processed view, show the formatted table
      return renderCashFlowData(data);
    }
    
    // For other report types
    const data = viewMode === 'processed' ? importDetails.processedData : importDetails.rawData;
    
    if (!data) {
      return <p className="text-gray-400">No {viewMode} data available</p>;
    }
    
    if (viewMode === 'processed') {
      // Log the actual data structure for debugging
      console.log('[Import Details Modal] Rendering processed data', {
        reportType: importDetails.reportType,
        dataKeys: Object.keys(data || {}),
        data: data
      });
      
      switch (importDetails.reportType) {
        case 'BALANCE_SHEET':
          return renderBalanceSheetData(data);
        case 'PROFIT_LOSS':
          return renderProfitLossData(data);
        case 'TRIAL_BALANCE':
          return renderTrialBalanceData(data);
        default:
          return renderGenericData(data);
      }
    }
    
    return renderGenericData(data);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
        
        <div className="relative bg-gray-900 rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h2 className="text-xl font-semibold text-white">Import Details</h2>
                {importDetails && (
                  <span className="text-sm text-gray-400">
                    {importDetails.reportType.replace('_', ' ')}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 text-brand-blue animate-spin" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <p className="text-red-400">{error}</p>
              </div>
            ) : importDetails ? (
              <div className="p-6">
                {/* Import Info */}
                <div className="bg-gray-800 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Import Date</p>
                      <p className="text-sm text-white">
                        {format(new Date(importDetails.importedAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Period</p>
                      <p className="text-sm text-white">
                        {format(new Date(importDetails.periodStart), 'MMM d, yyyy')} - {format(new Date(importDetails.periodEnd), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Source</p>
                      <div className="flex items-center space-x-2">
                        {importDetails.source === 'api' ? (
                          <Database className="h-4 w-4 text-purple-400" />
                        ) : (
                          <FileText className="h-4 w-4 text-blue-400" />
                        )}
                        <p className="text-sm text-white capitalize">{importDetails.source}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Records</p>
                      <p className="text-sm text-white">{formatNumber(importDetails.recordCount)}</p>
                    </div>
                  </div>
                  
                  {importDetails.fileName && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <p className="text-xs text-gray-500 mb-1">File Name</p>
                      <p className="text-sm text-white">{importDetails.fileName}</p>
                    </div>
                  )}
                </div>
                
                {/* View Mode Toggle & Export */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setViewMode('processed')}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                        viewMode === 'processed' 
                          ? "bg-brand-blue text-white" 
                          : "bg-gray-800 text-gray-400 hover:text-white"
                      )}
                    >
                      Processed Data
                    </button>
                    <button
                      onClick={() => setViewMode('raw')}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                        viewMode === 'raw' 
                          ? "bg-brand-blue text-white" 
                          : "bg-gray-800 text-gray-400 hover:text-white"
                      )}
                    >
                      Raw Data
                    </button>
                  </div>
                  
                  <button
                    onClick={exportData}
                    className="flex items-center space-x-2 px-4 py-2 bg-brand-emerald hover:bg-brand-emerald/80 text-white rounded-lg transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export JSON</span>
                  </button>
                </div>
                
                {/* Report Data */}
                <div className="space-y-6">
                  {renderReportData()}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}