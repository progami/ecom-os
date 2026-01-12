import { Suspense } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { QboConnectionCard } from '@/components/qbo-connection-card';

function QboCardFallback() {
  return (
    <Card className="col-span-full">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureCard({
  href,
  icon,
  title,
  description,
  badge,
  disabled,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  disabled?: boolean;
}) {
  const content = (
    <Card className={`group relative overflow-hidden transition-all duration-200 ${disabled ? 'opacity-60' : 'hover:shadow-lg hover:border-brand-teal-300 dark:hover:border-brand-cyan/40 cursor-pointer'}`}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-teal-500/10 to-brand-teal-500/5 dark:from-brand-cyan/15 dark:to-brand-cyan/5 ring-1 ring-brand-teal-500/20 dark:ring-brand-cyan/20">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-brand-teal-700 dark:group-hover:text-brand-cyan transition-colors">
                {title}
              </h3>
              {badge && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {badge}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {description}
            </p>
          </div>
          {!disabled && (
            <div className="shrink-0 text-slate-400 dark:text-slate-500 group-hover:text-brand-teal-600 dark:group-hover:text-brand-cyan transition-colors">
              <ArrowRightIcon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
      {!disabled && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-brand-teal-500 to-brand-teal-400 dark:from-brand-cyan dark:to-brand-cyan/60 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
      )}
    </Card>
  );

  if (disabled) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
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

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-[#041324] dark:to-[#020c18]">
      <div className="mx-auto max-w-4xl px-6 py-16">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-teal-500 to-brand-teal-600 dark:from-brand-cyan dark:to-brand-teal-500 shadow-lg shadow-brand-teal-500/25 dark:shadow-brand-cyan/20">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Plutus
            </h1>
            <Badge className="bg-brand-teal-100 text-brand-teal-700 dark:bg-brand-cyan/20 dark:text-brand-cyan border-0">
              Beta
            </Badge>
          </div>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl">
            Finance workspace for custom financials from QuickBooks Online.
            Ensure SOP compliance and generate reports QBO can&apos;t.
          </p>
        </header>

        {/* Content */}
        <div className="space-y-4">
          {/* QBO Connection */}
          <Suspense fallback={<QboCardFallback />}>
            <QboConnectionCard />
          </Suspense>

          {/* Feature Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureCard
              href="/plutus/transactions"
              icon={<DollarIcon className="h-6 w-6 text-brand-teal-600 dark:text-brand-cyan" />}
              title="Transactions"
              description="View purchases, check SOP compliance status, and update Reference/Memo fields in bulk."
            />

            <FeatureCard
              href="/plutus/chart-of-accounts"
              icon={<FolderIcon className="h-6 w-6 text-brand-teal-600 dark:text-brand-cyan" />}
              title="Chart of Accounts"
              description="Create custom account hierarchies and groupings that match your business structure."
              badge="Soon"
              disabled
            />

            <FeatureCard
              href="/plutus/reports"
              icon={<ChartIcon className="h-6 w-6 text-brand-teal-600 dark:text-brand-cyan" />}
              title="Custom Reports"
              description="Generate P&L, balance sheets, and cash flow reports with your own custom structure."
              badge="Soon"
              disabled
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-slate-200 dark:border-white/10">
          <p className="text-sm text-slate-500 dark:text-slate-500">
            Plutus is part of the{' '}
            <a href="/targonos" className="text-brand-teal-600 dark:text-brand-cyan hover:underline">
              Targonos
            </a>
            {' '}suite of business tools.
          </p>
        </footer>
      </div>
    </main>
  );
}
