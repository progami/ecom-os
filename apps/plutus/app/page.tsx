import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Link, TrendingUp, Wallet } from 'lucide-react';
import { QboConnectionCard } from '@/components/qbo-connection-card';

function QboCardFallback() {
  return (
    <Card className="card-hover">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal-500/10 dark:bg-brand-cyan/15">
            <Link className="h-5 w-5 text-brand-teal-600 dark:text-brand-cyan" />
          </div>
          <div className="flex-1">
            <Skeleton className="mb-2 h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="mb-4 h-10 w-full" />
        <Skeleton className="h-9 w-28" />
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Plutus
          </h1>
          <Badge variant="secondary">Beta</Badge>
        </div>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Finance workspace for custom financials from QuickBooks Online
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Suspense fallback={<QboCardFallback />}>
          <QboConnectionCard />
        </Suspense>

        <Card className="card-hover">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal-500/10 dark:bg-brand-cyan/15">
                <Wallet className="h-5 w-5 text-brand-teal-600 dark:text-brand-cyan" />
              </div>
              <div>
                <CardTitle className="text-base">Chart of Accounts</CardTitle>
                <CardDescription>Custom account groupings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Create custom account hierarchies and groupings that match your business needs.
            </p>
          </CardContent>
        </Card>

        <a href="/plutus/transactions" className="block">
          <Card className="card-hover cursor-pointer transition-all hover:border-brand-cyan/30">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal-500/10 dark:bg-brand-cyan/15">
                  <DollarSign className="h-5 w-5 text-brand-teal-600 dark:text-brand-cyan" />
                </div>
                <div>
                  <CardTitle className="text-base">Transactions</CardTitle>
                  <CardDescription>SOP compliance checker</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                View transactions, check SOP compliance, and update Reference/Memo fields.
              </p>
            </CardContent>
          </Card>
        </a>

        <Card className="card-hover">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal-500/10 dark:bg-brand-cyan/15">
                <TrendingUp className="h-5 w-5 text-brand-teal-600 dark:text-brand-cyan" />
              </div>
              <div>
                <CardTitle className="text-base">Custom Reports</CardTitle>
                <CardDescription>Financials that QBO can&apos;t do</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Generate custom P&L, balance sheets, and cash flow reports with your own structure.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
