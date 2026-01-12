'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { DataTable } from '@/components/ui/data-table';
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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
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

function TypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    'Expense': 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
    'Other Expense': 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
    'Cost of Goods Sold': 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  };

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap',
      colorMap[type] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
    )}>
      {type}
    </span>
  );
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

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: accounts.length };
    accounts.forEach((a) => {
      counts[a.type] = (counts[a.type] || 0) + 1;
    });
    return counts;
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const matchesSearch =
        !search ||
        account.name.toLowerCase().includes(search.toLowerCase()) ||
        account.acctNum?.toLowerCase().includes(search.toLowerCase()) ||
        account.subType?.toLowerCase().includes(search.toLowerCase()) ||
        account.fullyQualifiedName?.toLowerCase().includes(search.toLowerCase());
      const matchesType = !selectedType || account.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [accounts, search, selectedType]);

  const columns: ColumnDef<Account>[] = useMemo(
    () => [
      {
        accessorKey: 'acctNum',
        header: 'Number',
        cell: ({ row }) =>
          row.original.acctNum ? (
            <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-xs font-mono text-slate-600 dark:text-slate-300">
              {row.original.acctNum}
            </code>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 text-sm">—</span>
          ),
        enableSorting: true,
      },
      {
        accessorKey: 'name',
        header: 'Account Name',
        cell: ({ row }) => (
          <span className="font-medium text-slate-900 dark:text-white">
            {row.original.name}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => <TypeBadge type={row.original.type} />,
        enableSorting: true,
      },
      {
        accessorKey: 'subType',
        header: 'Sub Type',
        cell: ({ row }) =>
          row.original.subType ? (
            <span className="text-slate-600 dark:text-slate-400 text-sm">
              {row.original.subType}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 text-sm">—</span>
          ),
        enableSorting: true,
      },
      {
        accessorKey: 'fullyQualifiedName',
        header: 'Full Path',
        cell: ({ row }) =>
          row.original.fullyQualifiedName ? (
            <span className="text-slate-500 dark:text-slate-400 text-sm truncate max-w-[250px] block" title={row.original.fullyQualifiedName}>
              {row.original.fullyQualifiedName}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 text-sm">—</span>
          ),
        enableSorting: true,
      },
    ],
    []
  );

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-xl border border-danger-200 bg-danger-50 dark:border-danger-900 dark:bg-danger-950/50 p-8 text-center">
            <h2 className="text-lg font-semibold text-danger-700 dark:text-danger-400 mb-2">Error</h2>
            <p className="text-danger-600 dark:text-danger-300 mb-4">
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
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </Link>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Chart of Accounts</h1>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshIcon className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </header>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, number, or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-teal-500/30 focus:border-brand-teal-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-brand-cyan/30 dark:focus:border-brand-cyan"
            />
          </div>

          {/* Type Filter Tabs */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-lg">
            <FilterTab
              active={!selectedType}
              onClick={() => setSelectedType(null)}
              count={typeCounts.all}
              label="All"
            />
            {accountTypes.map((type) => (
              <FilterTab
                key={type}
                active={selectedType === type}
                onClick={() => setSelectedType(type)}
                count={typeCounts[type] || 0}
                label={type === 'Cost of Goods Sold' ? 'COGS' : type}
              />
            ))}
          </div>
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={filteredAccounts}
          loading={isLoading}
          skeletonRows={12}
          initialSorting={[{ id: 'name', desc: false }]}
          emptyState={
            <div className="py-8 flex flex-col items-center">
              <FolderIcon className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400">
                {search || selectedType ? 'No accounts match your filter' : 'No accounts found'}
              </p>
            </div>
          }
        />

        {/* Footer Summary */}
        {!isLoading && (
          <div className="flex items-center justify-between pt-2 text-sm text-slate-500 dark:text-slate-400">
            <span>
              Showing {filteredAccounts.length} of {accounts.length} expense accounts
            </span>
            <span>
              Synced from QuickBooks Online
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface FilterTabProps {
  active: boolean;
  onClick: () => void;
  count: number;
  label: string;
}

function FilterTab({ active, onClick, count, label }: FilterTabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap',
        active
          ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
      )}
    >
      {label}
      <span
        className={cn(
          'ml-0.5 px-1.5 py-0.5 rounded text-xs',
          active
            ? 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300'
            : 'bg-slate-200/50 dark:bg-white/5 text-slate-500 dark:text-slate-500'
        )}
      >
        {count}
      </span>
    </button>
  );
}
