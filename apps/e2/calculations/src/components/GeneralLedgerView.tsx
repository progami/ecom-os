'use client';

import React, { useState } from 'react';
import { GeneralLedgerData, TrialBalanceEntry, JournalEntry, AccountBalance } from '@/types/financial';
import { formatDateShort } from '@/lib/utils/dateFormatters';

interface GeneralLedgerViewProps {
  ledgerData: GeneralLedgerData;
}

type ViewType = 'trial-balance' | 'journal-entries' | 'account-balances';

export default function GeneralLedgerView({ ledgerData }: GeneralLedgerViewProps) {
  const [activeView, setActiveView] = useState<ViewType>('trial-balance');
  const [selectedAccountType, setSelectedAccountType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  if (!ledgerData) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <p className="text-gray-500 text-center">No ledger data available.</p>
      </div>
    );
  }

  // Calculate totals for trial balance
  const trialBalanceTotals = ledgerData.trialBalance?.reduce(
    (totals: any, entry: any) => ({
      debits: totals.debits + entry.debit,
      credits: totals.credits + entry.credit,
    }),
    { debits: 0, credits: 0 }
  ) || { debits: 0, credits: 0 };

  // Filter functions
  const filterByAccountType = (entries: TrialBalanceEntry[]) => {
    if (selectedAccountType === 'all') return entries;
    return entries.filter(entry => entry.accountType === selectedAccountType);
  };

  const filterBySearch = <T extends { accountName?: string; description?: string; accountCode?: string; [key: string]: any }>(items: T[]) => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item => 
      item.accountName?.toLowerCase().includes(term) ||
      item.description?.toLowerCase().includes(term)
    );
  };

  const filterJournalByMonth = (entries: JournalEntry[]) => {
    if (!selectedMonth) return entries;
    return entries.filter(entry => entry.date.startsWith(selectedMonth));
  };

  // Export functionality
  const exportToCSV = () => {
    let csvContent = '';
    
    if (activeView === 'trial-balance') {
      csvContent = 'Account Code,Account Name,Account Type,Debit,Credit,Balance\n';
      ledgerData.trialBalance?.forEach((entry: any) => {
        csvContent += `${entry.accountCode},${entry.accountName},${entry.accountType},${entry.debit},${entry.credit},${entry.balance}\n`;
      });
    } else if (activeView === 'journal-entries') {
      csvContent = 'Entry ID,Date,Description,Account Code,Account Name,Debit,Credit\n';
      ledgerData.journalEntries?.forEach((entry: any) => {
        entry.lines?.forEach((line: any) => {
          csvContent += `${entry.entryId},${entry.date},${entry.description},${line.accountCode},${line.accountName},${line.debit},${line.credit}\n`;
        });
      });
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `general-ledger-${activeView}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">General Ledger</h3>
            <p className="text-sm text-gray-600 mt-1">
              Double-entry bookkeeping records and account balances
            </p>
          </div>
          
          <button
            onClick={exportToCSV}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="mr-2 -ml-1 h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export to CSV
          </button>
        </div>

        {/* View Tabs */}
        <div className="mt-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveView('trial-balance')}
              className={`
                whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeView === 'trial-balance'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              Trial Balance
            </button>
            <button
              onClick={() => setActiveView('journal-entries')}
              className={`
                whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeView === 'journal-entries'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              Journal Entries
            </button>
            <button
              onClick={() => setActiveView('account-balances')}
              className={`
                whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeView === 'account-balances'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              Account Balances
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search accounts or descriptions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
          />
          
          {activeView === 'trial-balance' && (
            <select
              value={selectedAccountType}
              onChange={(e) => setSelectedAccountType(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Account Types</option>
              <option value="asset">Assets</option>
              <option value="liability">Liabilities</option>
              <option value="equity">Equity</option>
              <option value="revenue">Revenue</option>
              <option value="expense">Expenses</option>
            </select>
          )}
          
          {activeView === 'journal-entries' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
          )}
        </div>
      </div>

      {/* Trial Balance View */}
      {activeView === 'trial-balance' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Debit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filterBySearch(filterByAccountType(ledgerData.trialBalance || [])).map((entry) => (
                  <tr key={entry.accountCode} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {entry.accountCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.accountName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`
                        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${entry.accountType === 'asset' ? 'bg-blue-100 text-blue-800' : ''}
                        ${entry.accountType === 'liability' ? 'bg-red-100 text-red-800' : ''}
                        ${entry.accountType === 'equity' ? 'bg-purple-100 text-purple-800' : ''}
                        ${entry.accountType === 'revenue' ? 'bg-green-100 text-green-800' : ''}
                        ${entry.accountType === 'expense' ? 'bg-yellow-100 text-yellow-800' : ''}
                      `}>
                        {entry.accountType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {entry.debit > 0 ? `$${entry.debit.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {entry.credit > 0 ? `$${entry.credit.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                      ${Math.abs(entry.balance).toLocaleString()}
                      {entry.balance < 0 && ' (CR)'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-sm font-medium text-gray-900">
                    Totals
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                    ${trialBalanceTotals.debits.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-900">
                    ${trialBalanceTotals.credits.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                    {trialBalanceTotals.debits === trialBalanceTotals.credits ? (
                      <span className="text-green-600">✓ Balanced</span>
                    ) : (
                      <span className="text-red-600">
                        Difference: ${Math.abs(trialBalanceTotals.debits - trialBalanceTotals.credits).toLocaleString()}
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Journal Entries View */}
      {activeView === 'journal-entries' && (
        <div className="space-y-4">
          {filterBySearch(filterJournalByMonth(ledgerData.journalEntries || [])).map((entry) => (
            <div key={entry.entryId} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">
                    Entry #{entry.entryId}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
                </div>
                <span className="text-sm text-gray-500">
                  {formatDateShort(entry.date)}
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Account
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Debit
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Credit
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Memo
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {entry.lines.map((line: any, index: number) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm">
                          <span className="font-medium text-gray-900">{line.accountCode}</span>
                          <span className="text-gray-500 ml-2">{line.accountName}</span>
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-900">
                          {line.debit > 0 ? `$${line.debit.toLocaleString()}` : ''}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-900">
                          {line.credit > 0 ? `$${line.credit.toLocaleString()}` : ''}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {line.memo || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">
                        Totals
                      </td>
                      <td className="px-4 py-2 text-right text-sm font-bold text-gray-900">
                        ${entry.totalDebits.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right text-sm font-bold text-gray-900">
                        ${entry.totalCredits.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {entry.totalDebits === entry.totalCredits ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-red-600">Unbalanced</span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Account Balances View */}
      {activeView === 'account-balances' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Account Balance Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-800">Total Assets</p>
                <p className="text-2xl font-bold text-blue-900">
                  ${(ledgerData.accountBalances || [])
                    .filter((a: any) => a.accountCode.startsWith('1'))
                    .reduce((sum: number, a: any) => sum + a.balance, 0)
                    .toLocaleString()}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800">Total Liabilities</p>
                <p className="text-2xl font-bold text-red-900">
                  ${Math.abs((ledgerData.accountBalances || [])
                    .filter((a: any) => a.accountCode.startsWith('2'))
                    .reduce((sum: number, a: any) => sum + a.balance, 0))
                    .toLocaleString()}
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm font-medium text-purple-800">Total Equity</p>
                <p className="text-2xl font-bold text-purple-900">
                  ${Math.abs((ledgerData.accountBalances || [])
                    .filter((a: any) => a.accountCode.startsWith('3'))
                    .reduce((sum: number, a: any) => sum + a.balance, 0))
                    .toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Balance
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monthly Change
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    YTD Change
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filterBySearch(ledgerData.accountBalances || []).map((account) => (
                  <tr key={account.accountCode} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{account.accountCode}</div>
                        <div className="text-sm text-gray-500">{account.accountName}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                      ${Math.abs(account.balance).toLocaleString()}
                      {account.balance < 0 && ' (CR)'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <span className={account.monthlyChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {account.monthlyChange >= 0 ? '+' : ''}${account.monthlyChange.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <span className={account.ytdChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {account.ytdChange >= 0 ? '+' : ''}${account.ytdChange.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}