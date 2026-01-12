'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Account {
  id: string;
  name: string;
  type: string;
  subType?: string;
  fullyQualifiedName?: string;
  acctNum?: string;
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/plutus';

async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch(`${basePath}/api/qbo/accounts`);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to fetch accounts');
  }
  const data = await res.json();
  return data.accounts;
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

const ACCOUNT_TYPE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  'Expense': {
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    text: 'text-rose-700 dark:text-rose-400',
    ring: 'ring-rose-200 dark:ring-rose-900',
  },
  'Other Expense': {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    text: 'text-orange-700 dark:text-orange-400',
    ring: 'ring-orange-200 dark:ring-orange-900',
  },
  'Cost of Goods Sold': {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    ring: 'ring-amber-200 dark:ring-amber-900',
  },
};

function getAccountTypeColor(type: string) {
  return ACCOUNT_TYPE_COLORS[type] || {
    bg: 'bg-slate-50 dark:bg-slate-900/30',
    text: 'text-slate-700 dark:text-slate-400',
    ring: 'ring-slate-200 dark:ring-slate-800',
  };
}

export default function ChartOfAccountsPage() {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const { data: accounts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['qbo-accounts-full'],
    queryFn: fetchAccounts,
    staleTime: 5 * 60 * 1000,
  });

  const accountTypes = useMemo(() => {
    const types = new Set(accounts.map((a) => a.type));
    return Array.from(types).sort();
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const matchesSearch =
        !search ||
        account.name.toLowerCase().includes(search.toLowerCase()) ||
        account.acctNum?.toLowerCase().includes(search.toLowerCase()) ||
        account.subType?.toLowerCase().includes(search.toLowerCase());
      const matchesType = !selectedType || account.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [accounts, search, selectedType]);

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = {};
    filteredAccounts.forEach((account) => {
      if (!groups[account.type]) {
        groups[account.type] = [];
      }
      groups[account.type].push(account);
    });
    return groups;
  }, [filteredAccounts]);

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/50 p-8 text-center">
            <h2 className="text-lg font-semibold text-rose-700 dark:text-rose-400 mb-2">Error</h2>
            <p className="text-rose-600 dark:text-rose-300 mb-4">
              {error instanceof Error ? error.message : 'Failed to load accounts'}
            </p>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshIcon className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href={basePath}
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </a>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Chart of Accounts</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {accounts.length} expense accounts from QuickBooks
              </p>
            </div>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshIcon className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </header>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search accounts by name or number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-amber-400/30 dark:focus:border-amber-400"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-xl overflow-x-auto">
            <button
              onClick={() => setSelectedType(null)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                !selectedType
                  ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              All
            </button>
            {accountTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                  selectedType === type
                    ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Accounts List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-5 w-32 bg-slate-100 dark:bg-white/10 rounded animate-pulse" />
                  <div className="h-5 w-16 bg-slate-100 dark:bg-white/10 rounded animate-pulse" />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                      <div className="h-4 w-4 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
                      <div className="h-4 flex-1 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-12 text-center dark:border-white/10 dark:bg-white/5">
            <FolderIcon className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">No accounts found</h3>
            <p className="text-slate-500 dark:text-slate-400">
              {search ? 'Try adjusting your search or filter' : 'Connect to QuickBooks to sync your accounts'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAccounts).map(([type, typeAccounts]) => {
              const colors = getAccountTypeColor(type);
              return (
                <div
                  key={type}
                  className="rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-sm overflow-hidden dark:border-white/10 dark:bg-white/5"
                >
                  {/* Type Header */}
                  <div className={cn('px-6 py-4 border-b border-slate-100 dark:border-white/5', colors.bg)}>
                    <div className="flex items-center justify-between">
                      <h2 className={cn('text-lg font-semibold', colors.text)}>{type}</h2>
                      <Badge variant="secondary" className="text-xs">
                        {typeAccounts.length} accounts
                      </Badge>
                    </div>
                  </div>

                  {/* Accounts */}
                  <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {typeAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1', colors.bg, colors.ring)}>
                          <FolderIcon className={cn('h-5 w-5', colors.text)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-slate-900 dark:text-white truncate">
                              {account.name}
                            </h3>
                            {account.acctNum && (
                              <code className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 font-mono">
                                #{account.acctNum}
                              </code>
                            )}
                          </div>
                          {account.subType && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                              {account.subType}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary */}
        {!isLoading && filteredAccounts.length > 0 && (
          <div className="text-center text-sm text-slate-500 dark:text-slate-400 pt-4">
            Showing {filteredAccounts.length} of {accounts.length} accounts
          </div>
        )}
      </div>
    </div>
  );
}
