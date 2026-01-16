'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const basePath = process.env.NEXT_PUBLIC_BASE_PATH;

const AMAZON_DUPLICATE_ACCOUNTS = [
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
] as const;

const REQUIRED_PARENT_ACCOUNTS = [
  'Inventory Asset',
  'Manufacturing',
  'Freight & Custom Duty',
  'Land Freight',
  'Storage 3PL',
] as const;

const LMB_CHECKLIST_ITEMS = [
  { id: 'wizard', label: 'Run Setup Wizard in LMB' },
  { id: 'product-groups', label: 'Create Product Groups' },
  { id: 'skus', label: 'Assign SKUs to groups' },
  { id: 'settings', label: 'Configure Settings' },
  { id: 'unassigned', label: 'Create UNASSIGNED group' },
] as const;

const DEFAULT_BRANDS = ['UK-Dust Sheets', 'US-Dust Sheets'];

const STORAGE_KEY = 'plutus-setup-wizard';

type WizardState = {
  step: number;
  brands: string[];
  lmbChecks: string[];
  cleanupVerified: boolean;
  accountsCreated: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4', className)} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4', className)} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5 animate-spin', className)} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function CogIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205L12 12m6.894 5.785l-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864l-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function RocketIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5', className)} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Indicator
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Brands', icon: TagIcon },
  { id: 2, label: 'QBO Cleanup', icon: ShieldCheckIcon },
  { id: 3, label: 'Accounts', icon: CogIcon },
  { id: 4, label: 'LMB Setup', icon: LinkIcon },
  { id: 5, label: 'Complete', icon: RocketIcon },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {STEPS.map((step, index) => {
        const isActive = step.id === currentStep;
        const isComplete = step.id < currentStep;
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center">
            <div
              className={cn(
                'flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-all duration-300',
                isActive && 'bg-brand-teal-500/10 dark:bg-brand-cyan/10',
                isComplete && 'opacity-60'
              )}
            >
              <div
                className={cn(
                  'flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full transition-all duration-300',
                  isActive && 'bg-brand-teal-500 dark:bg-brand-cyan text-white',
                  isComplete && 'bg-emerald-500 text-white',
                  !isActive && !isComplete && 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500'
                )}
              >
                {isComplete ? (
                  <CheckIcon className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              <span
                className={cn(
                  'hidden sm:block text-xs font-medium transition-colors duration-300',
                  isActive && 'text-brand-teal-600 dark:text-brand-cyan',
                  isComplete && 'text-emerald-600 dark:text-emerald-400',
                  !isActive && !isComplete && 'text-slate-400 dark:text-slate-500'
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  'w-4 sm:w-8 h-0.5 mx-0.5 sm:mx-1 transition-colors duration-300',
                  step.id < currentStep
                    ? 'bg-emerald-400 dark:bg-emerald-500'
                    : 'bg-slate-200 dark:bg-white/10'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Brands
// ─────────────────────────────────────────────────────────────────────────────

function BrandsStep({
  brands,
  onBrandsChange,
  onNext,
}: {
  brands: string[];
  onBrandsChange: (brands: string[]) => void;
  onNext: () => void;
}) {
  const [newBrand, setNewBrand] = useState('');

  const addBrand = () => {
    const trimmed = newBrand.trim();
    if (trimmed && !brands.includes(trimmed)) {
      onBrandsChange([...brands, trimmed]);
      setNewBrand('');
    }
  };

  const removeBrand = (index: number) => {
    onBrandsChange(brands.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {brands.map((brand, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-teal-500/10 dark:bg-brand-cyan/10">
              <TagIcon className="h-4 w-4 text-brand-teal-600 dark:text-brand-cyan" />
            </div>
            <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">
              {brand}
            </span>
            <button
              onClick={() => removeBrand(index)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newBrand}
          onChange={(e) => setNewBrand(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addBrand()}
          placeholder="Add brand name..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-teal-500/20 dark:focus:ring-brand-cyan/20 focus:border-brand-teal-500 dark:focus:border-brand-cyan transition-all"
        />
        <Button
          onClick={addBrand}
          disabled={!newBrand.trim()}
          className="px-4 rounded-xl bg-brand-teal-500 hover:bg-brand-teal-600 dark:bg-brand-cyan dark:hover:bg-brand-cyan/90 text-white disabled:opacity-50"
        >
          <PlusIcon />
        </Button>
      </div>

      <div className="pt-4 border-t border-slate-200/60 dark:border-white/10">
        <Button
          onClick={onNext}
          disabled={brands.length === 0}
          className="w-full py-3 rounded-xl bg-brand-teal-500 hover:bg-brand-teal-600 dark:bg-brand-cyan dark:hover:bg-brand-cyan/90 text-white font-medium disabled:opacity-50 transition-all"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: QBO Cleanup Verification
// ─────────────────────────────────────────────────────────────────────────────

type QboAccountSummary = {
  name: string;
  active?: boolean;
  parentName: string | null;
};

type CleanupStatus = {
  duplicatesInactive: { name: string; status: 'pass' | 'fail' | 'pending' }[];
  parentsExist: { name: string; status: 'pass' | 'fail' | 'pending' }[];
};

function CleanupStep({
  onVerified,
  onNext,
  onBack,
}: {
  onVerified: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CleanupStatus>({
    duplicatesInactive: AMAZON_DUPLICATE_ACCOUNTS.map((name) => ({ name, status: 'pending' })),
    parentsExist: REQUIRED_PARENT_ACCOUNTS.map((name) => ({ name, status: 'pending' })),
  });

  const runVerification = async () => {
    setLoading(true);
    setVerified(false);
    setError(null);

    try {
      const res = await fetch(`${basePath}/api/qbo/accounts`);
      const data = await res.json();
      if (!res.ok) {
        if (typeof data?.error === 'string') {
          throw new Error(data.error);
        }
        throw new Error(`Failed to fetch accounts (${res.status})`);
      }

      const accounts: QboAccountSummary[] = data.accounts;

      // Check duplicates are inactive
      const duplicatesInactive = AMAZON_DUPLICATE_ACCOUNTS.map((name) => {
        const account = accounts.find(
          (a) => a.parentName === null && a.name.toLowerCase() === name.toLowerCase()
        );
        const isInactive = !account || account.active === false;
        return { name, status: (isInactive ? 'pass' : 'fail') as 'pass' | 'fail' };
      });

      // Check parents exist
      const parentsExist = REQUIRED_PARENT_ACCOUNTS.map((name) => {
        const account = accounts.find(
          (a) => a.parentName === null && a.name.toLowerCase() === name.toLowerCase() && a.active
        );
        return { name, status: (account ? 'pass' : 'fail') as 'pass' | 'fail' };
      });

      setStatus({ duplicatesInactive, parentsExist });

      const allPassed =
        duplicatesInactive.every((d) => d.status === 'pass') &&
        parentsExist.every((p) => p.status === 'pass');

      if (allPassed) {
        setVerified(true);
        onVerified();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const allPassed =
    status.duplicatesInactive.every((d) => d.status === 'pass') &&
    status.parentsExist.every((p) => p.status === 'pass');

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Duplicate Accounts (must be inactive)
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {status.duplicatesInactive.map((item) => (
              <div
                key={item.name}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors',
                  item.status === 'pending' && 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400',
                  item.status === 'pass' && 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                  item.status === 'fail' && 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                )}
              >
                {item.status === 'pass' && <CheckIcon className="h-3.5 w-3.5 flex-shrink-0" />}
                {item.status === 'fail' && <XIcon className="h-3.5 w-3.5 flex-shrink-0" />}
                {item.status === 'pending' && <span className="w-3.5 h-3.5 flex-shrink-0" />}
                <span className="truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Required Parent Accounts (must exist)
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {status.parentsExist.map((item) => (
              <div
                key={item.name}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors',
                  item.status === 'pending' && 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400',
                  item.status === 'pass' && 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                  item.status === 'fail' && 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                )}
              >
                {item.status === 'pass' && <CheckIcon className="h-3.5 w-3.5 flex-shrink-0" />}
                {item.status === 'fail' && <XIcon className="h-3.5 w-3.5 flex-shrink-0" />}
                {item.status === 'pending' && <span className="w-3.5 h-3.5 flex-shrink-0" />}
                <span className="truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t border-slate-200/60 dark:border-white/10">
        <Button
          onClick={onBack}
          variant="outline"
          className="flex-1 py-3 rounded-xl border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
        >
          Back
        </Button>
        {!verified && (
          <Button
            onClick={runVerification}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-brand-teal-500 hover:bg-brand-teal-600 dark:bg-brand-cyan dark:hover:bg-brand-cyan/90 text-white font-medium disabled:opacity-50"
          >
            {loading ? <SpinnerIcon className="h-5 w-5" /> : 'Verify'}
          </Button>
        )}
        {verified && allPassed && (
          <Button
            onClick={onNext}
            className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium"
          >
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Create Accounts
// ─────────────────────────────────────────────────────────────────────────────

function AccountsStep({
  onCreated,
  onNext,
  onBack,
}: {
  onCreated: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/api/qbo/accounts/create-plutus-qbo-lmb-plan`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        if (typeof data?.error === 'string') {
          throw new Error(data.error);
        }
        throw new Error(`Failed to create accounts (${res.status})`);
      }

      if (!Array.isArray(data?.created) || !Array.isArray(data?.skipped)) {
        throw new Error('Invalid response from create accounts endpoint');
      }

      setResult({ created: data.created.length, skipped: data.skipped.length });
      onCreated();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 text-left">
            {error}
          </div>
        )}
        {!result && !loading && (
          <div className="space-y-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-teal-500/10 dark:bg-brand-cyan/10">
              <CogIcon className="h-8 w-8 text-brand-teal-600 dark:text-brand-cyan" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              Create Plutus inventory + COGS sub-accounts and Inventory Shrinkage in QuickBooks
            </p>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            <SpinnerIcon className="h-12 w-12 text-brand-teal-500 dark:text-brand-cyan mx-auto" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Creating accounts...</p>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
              <CheckIcon className="h-8 w-8 text-emerald-500" />
            </div>
            <div className="flex justify-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {result.created}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Created</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-400 dark:text-slate-500">
                  {result.skipped}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Skipped</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4 border-t border-slate-200/60 dark:border-white/10">
        <Button
          onClick={onBack}
          variant="outline"
          className="flex-1 py-3 rounded-xl border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
        >
          Back
        </Button>
        {!result ? (
          <Button
            onClick={createAccounts}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-brand-teal-500 hover:bg-brand-teal-600 dark:bg-brand-cyan dark:hover:bg-brand-cyan/90 text-white font-medium disabled:opacity-50"
          >
            {loading ? <SpinnerIcon className="h-5 w-5" /> : 'Create Accounts'}
          </Button>
        ) : (
          <Button
            onClick={onNext}
            className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium"
          >
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: LMB Setup Checklist
// ─────────────────────────────────────────────────────────────────────────────

function LmbStep({
  checks,
  onChecksChange,
  onNext,
  onBack,
}: {
  checks: string[];
  onChecksChange: (checks: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const toggleCheck = (id: string) => {
    if (checks.includes(id)) {
      onChecksChange(checks.filter((c) => c !== id));
    } else {
      onChecksChange([...checks, id]);
    }
  };

  const allChecked = LMB_CHECKLIST_ITEMS.every((item) => checks.includes(item.id));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {LMB_CHECKLIST_ITEMS.map((item) => {
          const isChecked = checks.includes(item.id);
          return (
            <button
              key={item.id}
              onClick={() => toggleCheck(item.id)}
              className={cn(
                'flex items-center gap-3 w-full p-4 rounded-xl border transition-all',
                isChecked
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                  : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
              )}
            >
              <div
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all',
                  isChecked
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-slate-300 dark:border-slate-600'
                )}
              >
                {isChecked && <CheckIcon className="h-3.5 w-3.5 text-white" />}
              </div>
              <span
                className={cn(
                  'text-sm font-medium transition-colors',
                  isChecked
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-700 dark:text-slate-200'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 pt-4 border-t border-slate-200/60 dark:border-white/10">
        <Button
          onClick={onBack}
          variant="outline"
          className="flex-1 py-3 rounded-xl border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
        >
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!allChecked}
          className="flex-1 py-3 rounded-xl bg-brand-teal-500 hover:bg-brand-teal-600 dark:bg-brand-cyan dark:hover:bg-brand-cyan/90 text-white font-medium disabled:opacity-50"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5: Complete
// ─────────────────────────────────────────────────────────────────────────────

function CompleteStep({ brands, onReset }: { brands: string[]; onReset: () => void }) {
  return (
    <div className="space-y-6 text-center py-8">
      <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-brand-teal-500 dark:from-emerald-400 dark:to-brand-cyan">
        <RocketIcon className="h-10 w-10 text-white" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Setup Complete</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Plutus is ready for {brands.join(', ')}
        </p>
      </div>

      <div className="flex flex-col gap-3 pt-4">
        <Link href="/" className="block">
          <Button className="w-full py-3 rounded-xl bg-brand-teal-500 hover:bg-brand-teal-600 dark:bg-brand-cyan dark:hover:bg-brand-cyan/90 text-white font-medium">
            Go to Dashboard
          </Button>
        </Link>
        <Button
          onClick={onReset}
          variant="outline"
          className="w-full py-3 rounded-xl border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500"
        >
          Start Over
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Wizard Page
// ─────────────────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const [state, setState] = useState<WizardState>({
    step: 1,
    brands: DEFAULT_BRANDS,
    lmbChecks: [],
    cleanupVerified: false,
    accountsCreated: false,
  });

  // Load state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState(parsed);
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save state to localStorage
  const saveState = useCallback((newState: WizardState) => {
    setState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  }, []);

  const setStep = (step: number) => saveState({ ...state, step });
  const setBrands = (brands: string[]) => saveState({ ...state, brands });
  const setLmbChecks = (lmbChecks: string[]) => saveState({ ...state, lmbChecks });
  const setCleanupVerified = () => saveState({ ...state, cleanupVerified: true });
  const setAccountsCreated = () => saveState({ ...state, accountsCreated: true });

  const resetWizard = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState({
      step: 1,
      brands: DEFAULT_BRANDS,
      lmbChecks: [],
      cleanupVerified: false,
      accountsCreated: false,
    });
  };

  return (
    <main className="relative min-h-screen flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-[#0a1628] dark:via-[#0d1d32] dark:to-[#0a1628]" />
      <div className="fixed top-[-20%] right-[-10%] w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] rounded-full bg-gradient-to-br from-brand-teal-500/8 to-transparent blur-3xl dark:from-brand-cyan/5 pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] rounded-full bg-gradient-to-tr from-violet-500/8 to-transparent blur-3xl dark:from-violet-500/5 pointer-events-none" />

      <div className="relative flex-1 flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <header className="mb-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand-teal-600 dark:text-slate-400 dark:hover:text-brand-cyan transition-colors mb-4"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Plutus
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Setup Wizard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Configure Plutus with QuickBooks & Link My Books
          </p>
        </header>

        {/* Step Indicator */}
        <div className="mb-8">
          <StepIndicator currentStep={state.step} />
        </div>

        {/* Step Content */}
        <Card className="border-slate-200/60 bg-white/80 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
          <CardContent className="p-6">
            {state.step === 1 && (
              <BrandsStep
                brands={state.brands}
                onBrandsChange={setBrands}
                onNext={() => setStep(2)}
              />
            )}
            {state.step === 2 && (
              <CleanupStep
                onVerified={setCleanupVerified}
                onNext={() => setStep(3)}
                onBack={() => setStep(1)}
              />
            )}
            {state.step === 3 && (
              <AccountsStep
                onCreated={setAccountsCreated}
                onNext={() => setStep(4)}
                onBack={() => setStep(2)}
              />
            )}
            {state.step === 4 && (
              <LmbStep
                checks={state.lmbChecks}
                onChecksChange={setLmbChecks}
                onNext={() => setStep(5)}
                onBack={() => setStep(3)}
              />
            )}
            {state.step === 5 && (
              <CompleteStep brands={state.brands} onReset={resetWizard} />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
