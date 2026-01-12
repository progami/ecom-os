import { Suspense } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { QboConnectionCard } from '@/components/qbo-connection-card';

function QboCardFallback() {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-sm p-6 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>
    </div>
  );
}

function FeatureCard({
  href,
  icon,
  title,
  description,
  accentColor,
  delay = 0,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor: 'teal' | 'amber' | 'violet';
  delay?: number;
}) {
  const colorClasses = {
    teal: {
      bg: 'bg-brand-teal-500/10 dark:bg-brand-cyan/10',
      border: 'border-brand-teal-500/20 dark:border-brand-cyan/20',
      hoverBorder: 'group-hover:border-brand-teal-500/50 dark:group-hover:border-brand-cyan/50',
      icon: 'text-brand-teal-600 dark:text-brand-cyan',
      glow: 'group-hover:shadow-[0_0_40px_-12px_rgba(0,194,185,0.4)]',
      line: 'bg-gradient-to-r from-brand-teal-500 to-brand-teal-400 dark:from-brand-cyan dark:to-brand-teal-400',
    },
    amber: {
      bg: 'bg-amber-500/10 dark:bg-amber-400/10',
      border: 'border-amber-500/20 dark:border-amber-400/20',
      hoverBorder: 'group-hover:border-amber-500/50 dark:group-hover:border-amber-400/50',
      icon: 'text-amber-600 dark:text-amber-400',
      glow: 'group-hover:shadow-[0_0_40px_-12px_rgba(245,158,11,0.4)]',
      line: 'bg-gradient-to-r from-amber-500 to-amber-400',
    },
    violet: {
      bg: 'bg-violet-500/10 dark:bg-violet-400/10',
      border: 'border-violet-500/20 dark:border-violet-400/20',
      hoverBorder: 'group-hover:border-violet-500/50 dark:group-hover:border-violet-400/50',
      icon: 'text-violet-600 dark:text-violet-400',
      glow: 'group-hover:shadow-[0_0_40px_-12px_rgba(139,92,246,0.4)]',
      line: 'bg-gradient-to-r from-violet-500 to-violet-400',
    },
  };

  const colors = colorClasses[accentColor];

  return (
    <Link href={href} className="block">
      <div
        className={`group relative overflow-hidden rounded-2xl border bg-white/60 backdrop-blur-sm p-6 transition-all duration-500 cursor-pointer dark:bg-white/5 ${colors.border} ${colors.hoverBorder} ${colors.glow} hover:-translate-y-1`}
        style={{ animationDelay: `${delay}ms` }}
      >
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        <div className="relative flex items-start gap-5">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${colors.bg} ring-1 ${colors.border} transition-all duration-300 group-hover:scale-110`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight mb-1.5">
              {title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {description}
            </p>
          </div>
          <div className="shrink-0 pt-1 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-400 transition-all duration-300 group-hover:translate-x-1">
            <ArrowIcon className="h-5 w-5" />
          </div>
        </div>

        {/* Bottom accent line */}
        <div className={`absolute inset-x-0 bottom-0 h-[2px] ${colors.line} scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left`} />
      </div>
    </Link>
  );
}

function ComingSoonCard({
  icon,
  title,
  description,
  accentColor,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor: 'amber' | 'violet';
  delay?: number;
}) {
  const colorClasses = {
    amber: {
      bg: 'bg-amber-500/5 dark:bg-amber-400/5',
      border: 'border-slate-200/50 dark:border-white/5',
      icon: 'text-amber-600/50 dark:text-amber-400/50',
    },
    violet: {
      bg: 'bg-violet-500/5 dark:bg-violet-400/5',
      border: 'border-slate-200/50 dark:border-white/5',
      icon: 'text-violet-600/50 dark:text-violet-400/50',
    },
  };

  const colors = colorClasses[accentColor];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-slate-50/50 backdrop-blur-sm p-6 dark:bg-white/[0.02] ${colors.border} opacity-60`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative flex items-start gap-5">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${colors.bg} ring-1 ring-slate-200/50 dark:ring-white/5`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="text-lg font-semibold text-slate-400 dark:text-slate-500 tracking-tight">
              {title}
            </h3>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-0.5 rounded-full bg-slate-200/50 dark:bg-white/5">
              Soon
            </span>
          </div>
          <p className="text-sm text-slate-400 dark:text-slate-500 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  );
}

function TransactionsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
      <defs>
        <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <path stroke="url(#tealGrad)" strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );
}

function AccountsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
    </svg>
  );
}

function ReportsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Background layers */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-[#0a1628] dark:via-[#0d1d32] dark:to-[#0a1628]" />

      {/* Decorative gradient orbs */}
      <div className="fixed top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-brand-teal-500/10 to-transparent blur-3xl dark:from-brand-cyan/5" />
      <div className="fixed bottom-[-30%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-violet-500/10 to-transparent blur-3xl dark:from-violet-500/5" />

      {/* Grid overlay */}
      <div className="fixed inset-0 opacity-[0.015] dark:opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
        backgroundSize: '64px 64px',
      }} />

      {/* Content */}
      <div className="relative mx-auto max-w-3xl px-6 py-20">
        {/* Header */}
        <header className="mb-16 text-center">
          <div className="inline-flex items-center gap-3 mb-6">
            {/* Logo mark */}
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-teal-500 to-brand-teal-600 dark:from-brand-cyan dark:to-brand-teal-500 blur-xl opacity-40" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-teal-500 to-brand-teal-600 dark:from-brand-cyan dark:to-brand-teal-500 shadow-lg">
                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-left">
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                Plutus
              </h1>
              <span className="text-xs font-medium uppercase tracking-widest text-brand-teal-600 dark:text-brand-cyan">
                Beta
              </span>
            </div>
          </div>

          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            <span className="font-display italic text-slate-900 dark:text-white">Custom financials</span> from QuickBooks Online.
            <br />
            SOP compliance & reports QBO can&apos;t generate.
          </p>
        </header>

        {/* Connection Card */}
        <section className="mb-8">
          <Suspense fallback={<QboCardFallback />}>
            <QboConnectionCard />
          </Suspense>
        </section>

        {/* Feature Cards */}
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FeatureCard
              href="/transactions"
              icon={<TransactionsIcon className="h-7 w-7 text-brand-teal-600 dark:text-brand-cyan" />}
              title="Transactions"
              description="View purchases, check SOP compliance, and update Reference/Memo fields in bulk."
              accentColor="teal"
              delay={0}
            />

            <FeatureCard
              href="/chart-of-accounts"
              icon={<AccountsIcon className="h-7 w-7 text-amber-600 dark:text-amber-400" />}
              title="Chart of Accounts"
              description="View and manage your account hierarchies from QuickBooks."
              accentColor="amber"
              delay={100}
            />
          </div>

          <ComingSoonCard
            icon={<ReportsIcon className="h-7 w-7 text-violet-600/50 dark:text-violet-400/50" />}
            title="Custom Reports"
            description="Generate P&L, balance sheets, and cash flow reports with custom structure."
            accentColor="violet"
            delay={200}
          />
        </section>

        {/* Footer */}
        <footer className="mt-20 text-center">
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Part of the{' '}
            <a href="/" className="text-brand-teal-600 dark:text-brand-cyan hover:underline underline-offset-2 transition-colors">
              Targonos
            </a>
            {' '}suite
          </p>
        </footer>
      </div>
    </main>
  );
}
