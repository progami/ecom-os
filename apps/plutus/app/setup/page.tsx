'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH;

// External URLs
const LMB_APP_URL = 'https://app.linkmybooks.com';
const QBO_CHART_OF_ACCOUNTS_URL = 'https://app.qbo.intuit.com/app/chartofaccounts';

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
  { id: 'wizard-us', label: 'Run LMB Setup Wizard (US)' },
  { id: 'wizard-uk', label: 'Run LMB Setup Wizard (UK)' },
  { id: 'product-groups', label: 'Create Product Groups' },
  { id: 'skus', label: 'Assign SKUs to groups' },
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

// Step Indicator - Clean numbered steps
const STEPS = ['Brands', 'QBO Cleanup', 'Accounts', 'LMB Setup', 'Done'];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between max-w-md mx-auto">
      {STEPS.map((label, index) => {
        const stepNum = index + 1;
        const isActive = stepNum === currentStep;
        const isComplete = stepNum < currentStep;

        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all',
                  isActive && 'bg-teal-500 text-white',
                  isComplete && 'bg-teal-500 text-white',
                  !isActive && !isComplete && 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                )}
              >
                {isComplete ? '✓' : stepNum}
              </div>
              <span
                className={cn(
                  'mt-1 text-xs font-medium',
                  isActive && 'text-teal-600 dark:text-teal-400',
                  isComplete && 'text-slate-500 dark:text-slate-400',
                  !isActive && !isComplete && 'text-slate-400 dark:text-slate-500'
                )}
              >
                {label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  'w-8 sm:w-12 h-0.5 mx-2',
                  stepNum < currentStep ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Step 1: Brands
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
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Your Brands</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Add the brands you sell on Amazon. These will be used to create sub-accounts in QBO.
        </p>
      </div>

      <div className="space-y-3">
        {brands.map((brand, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            <span className="font-medium text-slate-900 dark:text-white">{brand}</span>
            <button
              onClick={() => removeBrand(index)}
              className="text-slate-400 hover:text-red-500 transition-colors"
            >
              ✕
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
          className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        />
        <Button onClick={addBrand} disabled={!newBrand.trim()} className="bg-teal-500 hover:bg-teal-600 text-white">
          Add
        </Button>
      </div>

      <Button
        onClick={onNext}
        disabled={brands.length === 0}
        className="w-full bg-teal-500 hover:bg-teal-600 text-white"
      >
        Continue
      </Button>
    </div>
  );
}

// Step 2: QBO Cleanup
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
        throw new Error(data?.error || `Failed to fetch accounts (${res.status})`);
      }

      const accounts: QboAccountSummary[] = data.accounts;

      const duplicatesInactive = AMAZON_DUPLICATE_ACCOUNTS.map((name) => {
        const account = accounts.find(
          (a) => a.parentName === null && a.name.toLowerCase() === name.toLowerCase()
        );
        const isInactive = !account || account.active === false;
        return { name, status: (isInactive ? 'pass' : 'fail') as 'pass' | 'fail' };
      });

      const parentsExist = REQUIRED_PARENT_ACCOUNTS.map((name) => {
        const account = accounts.find(
          (a) => a.parentName === null && a.name.toLowerCase() === name.toLowerCase()
        );
        const exists = account && account.active !== false;
        return { name, status: (exists ? 'pass' : 'fail') as 'pass' | 'fail' };
      });

      setStatus({ duplicatesInactive, parentsExist });

      const allPassed =
        duplicatesInactive.every((d) => d.status === 'pass') &&
        parentsExist.every((p) => p.status === 'pass');

      if (allPassed) {
        setVerified(true);
        onVerified();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const hasFailed = status.duplicatesInactive.some((d) => d.status === 'fail') ||
    status.parentsExist.some((p) => p.status === 'fail');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">QBO Cleanup Check</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Before creating Plutus accounts, we need to verify your QBO setup is clean.
        </p>
      </div>

      {/* Action box - LMB Setup first */}
      <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
          <strong>First time?</strong> Run the LMB Setup Wizard before verifying.
        </p>
        <a
          href={LMB_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors"
        >
          Open Link My Books →
        </a>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Duplicate accounts check */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Duplicates (must be inactive or missing)
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {status.duplicatesInactive.map((item) => (
            <div
              key={item.name}
              className={cn(
                'px-3 py-2 rounded text-xs font-medium',
                item.status === 'pending' && 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
                item.status === 'pass' && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                item.status === 'fail' && 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              )}
            >
              {item.status === 'pass' && '✓ '}
              {item.status === 'fail' && '✗ '}
              {item.name}
            </div>
          ))}
        </div>
      </div>

      {/* Parent accounts check */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Parent Accounts (must exist)
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {status.parentsExist.map((item) => (
            <div
              key={item.name}
              className={cn(
                'px-3 py-2 rounded text-xs font-medium',
                item.status === 'pending' && 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
                item.status === 'pass' && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                item.status === 'fail' && 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              )}
            >
              {item.status === 'pass' && '✓ '}
              {item.status === 'fail' && '✗ '}
              {item.name}
            </div>
          ))}
        </div>
      </div>

      {/* Fix issues link */}
      {hasFailed && (
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Fix the issues above in QuickBooks, then re-verify.
          </p>
          <a
            href={QBO_CHART_OF_ACCOUNTS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white text-sm font-medium transition-colors"
          >
            Open QBO Chart of Accounts →
          </a>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
        <Button onClick={onBack} variant="outline" className="flex-1">
          Back
        </Button>
        {!verified ? (
          <Button
            onClick={runVerification}
            disabled={loading}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
          >
            {loading ? 'Checking...' : 'Verify'}
          </Button>
        ) : (
          <Button onClick={onNext} className="flex-1 bg-green-500 hover:bg-green-600 text-white">
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}

// Step 3: Create Accounts
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
        throw new Error(data?.error || `Failed to create accounts (${res.status})`);
      }

      if (!Array.isArray(data?.created) || !Array.isArray(data?.skipped)) {
        throw new Error('Invalid response from server');
      }

      setResult({ created: data.created.length, skipped: data.skipped.length });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Create Plutus Accounts</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Create the inventory and COGS sub-accounts in QuickBooks for your brands.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {!result && !loading && (
        <div className="p-8 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            This will create ~45 sub-accounts for inventory tracking and cost allocation.
          </p>
          <Button
            onClick={createAccounts}
            className="bg-teal-500 hover:bg-teal-600 text-white"
          >
            Create Accounts
          </Button>
        </div>
      )}

      {loading && (
        <div className="p-8 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-slate-600 dark:text-slate-400">Creating accounts...</p>
        </div>
      )}

      {result && (
        <div className="p-8 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-center">
          <p className="text-lg font-semibold text-green-700 dark:text-green-400 mb-2">Done!</p>
          <div className="flex justify-center gap-8">
            <div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{result.created}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Created</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-400">{result.skipped}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Skipped</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
        <Button onClick={onBack} variant="outline" className="flex-1">
          Back
        </Button>
        {result && (
          <Button onClick={onNext} className="flex-1 bg-green-500 hover:bg-green-600 text-white">
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}

// Step 4: LMB Setup Checklist
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
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">LMB Configuration</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Complete these steps in Link My Books to finish setup.
        </p>
      </div>

      {/* Open LMB button */}
      <div className="p-4 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
        <a
          href={LMB_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium transition-colors"
        >
          Open Link My Books →
        </a>
      </div>

      <div className="space-y-2">
        {LMB_CHECKLIST_ITEMS.map((item) => {
          const isChecked = checks.includes(item.id);
          return (
            <button
              key={item.id}
              onClick={() => toggleCheck(item.id)}
              className={cn(
                'flex items-center gap-3 w-full p-4 rounded-lg border transition-all text-left',
                isChecked
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              )}
            >
              <div
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded border-2 text-xs',
                  isChecked
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                )}
              >
                {isChecked && '✓'}
              </div>
              <span
                className={cn(
                  'font-medium',
                  isChecked ? 'text-green-700 dark:text-green-400' : 'text-slate-700 dark:text-slate-300'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
        <Button onClick={onBack} variant="outline" className="flex-1">
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!allChecked}
          className="flex-1 bg-teal-500 hover:bg-teal-600 text-white disabled:opacity-50"
        >
          Finish Setup
        </Button>
      </div>
    </div>
  );
}

// Step 5: Complete
function CompleteStep({ brands, onReset }: { brands: string[]; onReset: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="text-4xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Setup Complete!</h2>
      <p className="text-slate-500 dark:text-slate-400 mb-6">
        Plutus is ready for {brands.join(' & ')}.
      </p>

      <div className="space-y-3">
        <Link href="/" className="block">
          <Button className="w-full bg-teal-500 hover:bg-teal-600 text-white">
            Go to Dashboard
          </Button>
        </Link>
        <Button onClick={onReset} variant="outline" className="w-full">
          Start Over
        </Button>
      </div>
    </div>
  );
}

// Main Wizard
export default function SetupPage() {
  const [state, setState] = useState<WizardState>({
    step: 1,
    brands: DEFAULT_BRANDS,
    lmbChecks: [],
    cleanupVerified: false,
    accountsCreated: false,
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch {
        // Ignore
      }
    }
  }, []);

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
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400 mb-4"
          >
            ← Back to Plutus
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Setup Wizard</h1>
        </div>

        {/* Steps */}
        <div className="mb-8">
          <StepIndicator currentStep={state.step} />
        </div>

        {/* Content */}
        <Card className="border-slate-200 dark:border-slate-700">
          <CardContent className="p-6">
            {state.step === 1 && (
              <BrandsStep brands={state.brands} onBrandsChange={setBrands} onNext={() => setStep(2)} />
            )}
            {state.step === 2 && (
              <CleanupStep onVerified={setCleanupVerified} onNext={() => setStep(3)} onBack={() => setStep(1)} />
            )}
            {state.step === 3 && (
              <AccountsStep onCreated={setAccountsCreated} onNext={() => setStep(4)} onBack={() => setStep(2)} />
            )}
            {state.step === 4 && (
              <LmbStep checks={state.lmbChecks} onChecksChange={setLmbChecks} onNext={() => setStep(5)} onBack={() => setStep(3)} />
            )}
            {state.step === 5 && <CompleteStep brands={state.brands} onReset={resetWizard} />}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
