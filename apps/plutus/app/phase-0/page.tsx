'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { NotConnectedScreen } from '@/components/not-connected-screen';
import { cn } from '@/lib/utils';

interface Account {
  id: string;
  name: string;
  type: string;
  subType?: string;
  fullyQualifiedName?: string;
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/plutus';

// Phase 0 Verification Constants
const DUPLICATE_ACCOUNTS_TO_DELETE = [
  'Amazon Sales',
  'Amazon Refunds',
  'Amazon Reimbursement',
  'Amazon Reimbursements',
  'Amazon Shipping',
  'Amazon Advertising',
  'Amazon FBA Fees',
  'Amazon Seller Fees',
  'Amazon Storage Fees',
  'Amazon FBA Inventory Reimbursement',
  'Amazon Carried Balances',
  'Amazon Pending Balances',
  'Amazon Deferred Balances',
  'Amazon Reserved Balances',
  'Amazon Split Month Rollovers',
  'Amazon Loans',
  'Amazon Sales Tax',
  'Amazon Sales Tax Collected',
];

const REQUIRED_PARENT_ACCOUNTS = [
  'Inventory Asset',
  'Manufacturing',
  'Freight & Custom Duty',
  'Land Freight',
  'Storage 3PL',
];

async function fetchAccounts(): Promise<{ accounts: Account[]; total: number }> {
  const res = await fetch(`${basePath}/api/qbo/accounts`);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to fetch accounts');
  }
  return res.json();
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function ShieldXIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.5h.008v.008H12v-.008z" />
    </svg>
  );
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

type VerificationStatus = 'idle' | 'checking' | 'complete';

export default function Phase0Page() {
  const [hasRun, setHasRun] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['qbo-accounts-phase0'],
    queryFn: fetchAccounts,
    enabled: false, // Don't auto-fetch
    staleTime: 0,
  });

  const accounts = data?.accounts ?? [];
  const accountNames = useMemo(() => new Set(accounts.map((a) => a.name)), [accounts]);

  // Verification results
  const duplicateResults = useMemo(() => {
    return DUPLICATE_ACCOUNTS_TO_DELETE.map((name) => ({
      name,
      found: accountNames.has(name),
      pass: !accountNames.has(name), // Pass if NOT found (deleted/inactive)
    }));
  }, [accountNames]);

  const requiredResults = useMemo(() => {
    return REQUIRED_PARENT_ACCOUNTS.map((name) => ({
      name,
      found: accountNames.has(name),
      pass: accountNames.has(name), // Pass if found (exists)
    }));
  }, [accountNames]);

  const duplicatesPassed = duplicateResults.filter((r) => r.pass).length;
  const duplicatesFailed = duplicateResults.filter((r) => !r.pass).length;
  const requiredPassed = requiredResults.filter((r) => r.pass).length;
  const requiredFailed = requiredResults.filter((r) => !r.pass).length;

  const allPassed = hasRun && duplicatesFailed === 0 && requiredFailed === 0;
  const status: VerificationStatus = isFetching ? 'checking' : hasRun ? 'complete' : 'idle';

  const handleRunVerification = async () => {
    await refetch();
    setHasRun(true);
  };

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load accounts';
    if (errorMessage === 'Not connected to QBO') {
      return <NotConnectedScreen title="Phase 0 Verification" />;
    }

    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50 p-8 text-center">
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">Error</h2>
            <p className="text-red-600 dark:text-red-300 mb-4">{errorMessage}</p>
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
    <div className="min-h-screen bg-[#0c0c0f] text-white">
      {/* Scanline effect overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-50"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)`,
        }}
      />

      {/* Grid background */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,194,185,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,194,185,0.3) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Gradient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-brand-cyan/10 via-brand-cyan/5 to-transparent blur-3xl" />

      <div className="relative max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand-cyan transition-colors mb-8"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <div className="flex items-start gap-6">
            <div className="relative">
              <div className="absolute inset-0 bg-brand-cyan/20 rounded-2xl blur-xl" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-cyan/20 to-brand-cyan/5 border border-brand-cyan/30">
                <TerminalIcon className="h-8 w-8 text-brand-cyan" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold tracking-tight font-mono">PHASE_0</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 rounded">
                  QBO Cleanup
                </span>
              </div>
              <p className="text-slate-400 max-w-lg">
                Verify duplicate Amazon accounts are inactive and required parent accounts exist in QuickBooks Online.
              </p>
            </div>
          </div>
        </header>

        {/* Status Banner */}
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border p-6 mb-8 transition-all duration-500',
            status === 'idle' && 'bg-slate-900/50 border-slate-800',
            status === 'checking' && 'bg-amber-950/30 border-amber-500/30',
            status === 'complete' && allPassed && 'bg-emerald-950/30 border-emerald-500/30',
            status === 'complete' && !allPassed && 'bg-red-950/30 border-red-500/30'
          )}
        >
          {/* Animated border glow */}
          {status === 'checking' && (
            <div className="absolute inset-0 rounded-2xl animate-pulse bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10" />
          )}

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              {status === 'idle' && (
                <>
                  <div className="h-12 w-12 rounded-xl bg-slate-800 flex items-center justify-center">
                    <ShieldCheckIcon className="h-6 w-6 text-slate-500" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-slate-300">Ready to Verify</div>
                    <div className="text-sm text-slate-500">Click the button to run Phase 0 verification</div>
                  </div>
                </>
              )}

              {status === 'checking' && (
                <>
                  <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <RefreshIcon className="h-6 w-6 text-amber-400 animate-spin" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-amber-300">Verifying...</div>
                    <div className="text-sm text-amber-400/70">Fetching accounts from QuickBooks Online</div>
                  </div>
                </>
              )}

              {status === 'complete' && allPassed && (
                <>
                  <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <ShieldCheckIcon className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-emerald-300">Phase 0 Complete</div>
                    <div className="text-sm text-emerald-400/70">
                      All {DUPLICATE_ACCOUNTS_TO_DELETE.length + REQUIRED_PARENT_ACCOUNTS.length} checks passed
                    </div>
                  </div>
                </>
              )}

              {status === 'complete' && !allPassed && (
                <>
                  <div className="h-12 w-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                    <ShieldXIcon className="h-6 w-6 text-red-400" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-red-300">Phase 0 Incomplete</div>
                    <div className="text-sm text-red-400/70">
                      {duplicatesFailed + requiredFailed} issue{duplicatesFailed + requiredFailed !== 1 ? 's' : ''} found
                      — see details below
                    </div>
                  </div>
                </>
              )}
            </div>

            <Button
              onClick={handleRunVerification}
              disabled={isFetching}
              className={cn(
                'rounded-xl font-mono text-sm px-6 transition-all duration-300',
                status === 'idle' &&
                  'bg-brand-cyan hover:bg-brand-cyan/90 text-black shadow-lg shadow-brand-cyan/25',
                status === 'checking' && 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
                status === 'complete' &&
                  'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              )}
            >
              <RefreshIcon className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
              {status === 'idle' ? 'Run Verification' : status === 'checking' ? 'Checking...' : 'Re-run'}
            </Button>
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Duplicate Accounts Check */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-white font-mono text-sm tracking-wide">
                    DUPLICATE_ACCOUNTS
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Should be deleted or inactive</p>
                </div>
                {hasRun && (
                  <div
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-bold font-mono',
                      duplicatesFailed === 0
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    )}
                  >
                    {duplicatesPassed}/{DUPLICATE_ACCOUNTS_TO_DELETE.length}
                  </div>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-800/50">
              {DUPLICATE_ACCOUNTS_TO_DELETE.map((name, i) => {
                const result = duplicateResults.find((r) => r.name === name);
                const showResult = hasRun && result;

                return (
                  <div
                    key={name}
                    className={cn(
                      'px-5 py-3 flex items-center justify-between transition-all duration-300',
                      showResult && result.pass && 'bg-emerald-500/5',
                      showResult && !result.pass && 'bg-red-500/5'
                    )}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <span
                      className={cn(
                        'text-sm transition-colors',
                        !hasRun && 'text-slate-500',
                        showResult && result.pass && 'text-slate-400',
                        showResult && !result.pass && 'text-red-300'
                      )}
                    >
                      {name}
                    </span>

                    {!hasRun && <div className="h-5 w-5 rounded-full bg-slate-800" />}

                    {showResult && result.pass && (
                      <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <CheckIcon className="h-3 w-3 text-emerald-400" />
                      </div>
                    )}

                    {showResult && !result.pass && (
                      <div className="h-5 w-5 rounded-full bg-red-500/20 flex items-center justify-center">
                        <XIcon className="h-3 w-3 text-red-400" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Required Accounts Check */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-white font-mono text-sm tracking-wide">
                    REQUIRED_ACCOUNTS
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Must exist and be active</p>
                </div>
                {hasRun && (
                  <div
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-bold font-mono',
                      requiredFailed === 0
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    )}
                  >
                    {requiredPassed}/{REQUIRED_PARENT_ACCOUNTS.length}
                  </div>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-800/50">
              {REQUIRED_PARENT_ACCOUNTS.map((name, i) => {
                const result = requiredResults.find((r) => r.name === name);
                const showResult = hasRun && result;

                return (
                  <div
                    key={name}
                    className={cn(
                      'px-5 py-3 flex items-center justify-between transition-all duration-300',
                      showResult && result.pass && 'bg-emerald-500/5',
                      showResult && !result.pass && 'bg-red-500/5'
                    )}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <span
                      className={cn(
                        'text-sm transition-colors',
                        !hasRun && 'text-slate-500',
                        showResult && result.pass && 'text-slate-400',
                        showResult && !result.pass && 'text-red-300'
                      )}
                    >
                      {name}
                    </span>

                    {!hasRun && <div className="h-5 w-5 rounded-full bg-slate-800" />}

                    {showResult && result.pass && (
                      <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <CheckIcon className="h-3 w-3 text-emerald-400" />
                      </div>
                    )}

                    {showResult && !result.pass && (
                      <div className="h-5 w-5 rounded-full bg-red-500/20 flex items-center justify-center">
                        <XIcon className="h-3 w-3 text-red-400" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Help */}
        {hasRun && !allPassed && (
          <div className="mt-8 p-5 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <h3 className="font-semibold text-amber-300 mb-2 font-mono text-sm">NEXT_STEPS</h3>
            <ul className="text-sm text-amber-200/70 space-y-1.5">
              {duplicatesFailed > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">→</span>
                  <span>
                    Make {duplicatesFailed} duplicate account{duplicatesFailed !== 1 ? 's' : ''} inactive in QBO
                    (Settings → Chart of Accounts → Edit → Make inactive)
                  </span>
                </li>
              )}
              {requiredFailed > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">→</span>
                  <span>
                    Create {requiredFailed} missing parent account{requiredFailed !== 1 ? 's' : ''} in QBO before
                    proceeding to Phase 1
                  </span>
                </li>
              )}
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">→</span>
                <span>After making changes in QBO, click &quot;Re-run&quot; to verify</span>
              </li>
            </ul>
          </div>
        )}

        {/* Success Next Step */}
        {hasRun && allPassed && (
          <div className="mt-8 p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <h3 className="font-semibold text-emerald-300 mb-2 font-mono text-sm">READY_FOR_PHASE_1</h3>
            <p className="text-sm text-emerald-200/70 mb-4">
              All prerequisite checks passed. You can now proceed to Phase 1 to create Plutus accounts.
            </p>
            <Link
              href="/chart-of-accounts"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
            >
              Go to Chart of Accounts
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 text-center">
          <p className="text-xs text-slate-600 font-mono">
            PLUTUS_QBO_LMB_PLAN // PHASE_0_VERIFICATION
          </p>
        </footer>
      </div>
    </div>
  );
}
