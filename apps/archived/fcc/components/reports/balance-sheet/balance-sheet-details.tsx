'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, DollarSign } from 'lucide-react';
import { formatNumber } from '@/lib/design-tokens';
import type { BalanceSheetData } from '@/lib/schemas/report-schemas';

interface BalanceSheetDetailsProps {
  data: BalanceSheetData;
}

interface CollapsibleSectionProps {
  title: string;
  total: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  variant?: 'assets' | 'liabilities' | 'equity';
}

function CollapsibleSection({ title, total, children, defaultOpen = true, variant = 'assets' }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const variantStyles = {
    assets: 'border-blue-500/20 bg-blue-500/5',
    liabilities: 'border-red-500/20 bg-red-500/5',
    equity: 'border-emerald-500/20 bg-emerald-500/5'
  };

  const variantTextColors = {
    assets: 'text-blue-400',
    liabilities: 'text-red-400',
    equity: 'text-emerald-400'
  };

  return (
    <div className={`border rounded-xl overflow-hidden transition-all duration-200 ${variantStyles[variant]}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center space-x-3">
          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <span className={`text-lg font-semibold ${variantTextColors[variant]}`}>
          {formatNumber(total, { currency: true, currencyCode: 'GBP' })}
        </span>
      </button>
      {isOpen && (
        <div className="px-6 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

interface AccountRowProps {
  account: {
    accountId?: string;
    accountCode?: string;
    accountName: string;
    accountType?: string;
    balance: number;
  };
  indent?: boolean;
}

function AccountRow({ account, indent = false }: AccountRowProps) {
  return (
    <div className={`flex items-center justify-between py-3 border-b border-slate-700/50 last:border-0 ${indent ? 'pl-8' : ''}`}>
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{account.accountName}</p>
        {account.accountCode && (
          <p className="text-xs text-slate-500 mt-0.5">Code: {account.accountCode}</p>
        )}
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-white">
          {formatNumber(Math.abs(account.balance), { currency: true, currencyCode: 'GBP' })}
        </p>
        {account.accountType && (
          <p className="text-xs text-slate-500 mt-0.5">{account.accountType}</p>
        )}
      </div>
    </div>
  );
}

export function BalanceSheetDetails({ data }: BalanceSheetDetailsProps) {
  // Check if we have detailed data or just summary
  if (!data.assets || !data.liabilities || !data.equity) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-400">Detailed account information is not available for this data source.</p>
        <p className="text-slate-500 text-sm mt-2">Try refreshing to fetch live data from Xero.</p>
      </div>
    );
  }

  const currentAssetsTotal = data.assets.currentAssets.reduce((sum, acc) => sum + acc.balance, 0);
  const nonCurrentAssetsTotal = data.assets.nonCurrentAssets.reduce((sum, acc) => sum + acc.balance, 0);
  const currentLiabilitiesTotal = data.liabilities.currentLiabilities.reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
  const nonCurrentLiabilitiesTotal = data.liabilities.nonCurrentLiabilities.reduce((sum, acc) => sum + Math.abs(acc.balance), 0);

  return (
    <div className="space-y-6">
      {/* Assets Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-white">Assets</h2>
          <span className="text-lg font-semibold text-blue-400">
            {formatNumber(data.totalAssets, { currency: true, currencyCode: 'GBP' })}
          </span>
        </div>

        {/* Current Assets */}
        <CollapsibleSection
          title="Current Assets"
          total={currentAssetsTotal}
          variant="assets"
        >
          <div className="mt-4 space-y-1">
            {data.assets.currentAssets.map((account, index) => (
              <AccountRow key={account.accountId || index} account={account} />
            ))}
          </div>
        </CollapsibleSection>

        {/* Non-Current Assets */}
        <CollapsibleSection
          title="Non-Current Assets"
          total={nonCurrentAssetsTotal}
          variant="assets"
        >
          <div className="mt-4 space-y-1">
            {data.assets.nonCurrentAssets.map((account, index) => (
              <AccountRow key={account.accountId || index} account={account} />
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* Liabilities Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-white">Liabilities</h2>
          <span className="text-lg font-semibold text-red-400">
            {formatNumber(Math.abs(data.totalLiabilities), { currency: true, currencyCode: 'GBP' })}
          </span>
        </div>

        {/* Current Liabilities */}
        <CollapsibleSection
          title="Current Liabilities"
          total={currentLiabilitiesTotal}
          variant="liabilities"
        >
          <div className="mt-4 space-y-1">
            {data.liabilities.currentLiabilities.map((account, index) => (
              <AccountRow key={account.accountId || index} account={account} />
            ))}
          </div>
        </CollapsibleSection>

        {/* Non-Current Liabilities */}
        <CollapsibleSection
          title="Non-Current Liabilities"
          total={nonCurrentLiabilitiesTotal}
          variant="liabilities"
        >
          <div className="mt-4 space-y-1">
            {data.liabilities.nonCurrentLiabilities.map((account, index) => (
              <AccountRow key={account.accountId || index} account={account} />
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* Equity Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-white">Equity</h2>
          <span className="text-lg font-semibold text-emerald-400">
            {formatNumber(data.totalEquity, { currency: true, currencyCode: 'GBP' })}
          </span>
        </div>

        <CollapsibleSection
          title="Equity Accounts"
          total={data.totalEquity}
          variant="equity"
          defaultOpen={true}
        >
          <div className="mt-4 space-y-1">
            {data.equity.accounts.map((account, index) => (
              <AccountRow key={account.accountId || index} account={account} />
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* Summary Bar */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-sm text-slate-400 mb-1">Total Assets</p>
            <p className="text-xl font-semibold text-blue-400">
              {formatNumber(data.totalAssets, { currency: true, currencyCode: 'GBP' })}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-400 mb-1">Total Liabilities</p>
            <p className="text-xl font-semibold text-red-400">
              {formatNumber(Math.abs(data.totalLiabilities), { currency: true, currencyCode: 'GBP' })}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-400 mb-1">Net Assets (Equity)</p>
            <p className="text-xl font-semibold text-emerald-400">
              {formatNumber(data.netAssets, { currency: true, currencyCode: 'GBP' })}
            </p>
          </div>
        </div>

        {/* Balance Check */}
        <div className="mt-6 pt-6 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Balance Check (Assets = Liabilities + Equity)</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-white">
                {formatNumber(data.totalAssets, { currency: true, currencyCode: 'GBP' })} = {formatNumber(Math.abs(data.totalLiabilities) + data.totalEquity, { currency: true, currencyCode: 'GBP' })}
              </span>
              {Math.abs(data.totalAssets - (Math.abs(data.totalLiabilities) + data.totalEquity)) < 0.01 && (
                <span className="text-xs text-emerald-400 font-medium">✓ Balanced</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}