import Link from 'next/link';
import { ArrowRight, Sparkles, Zap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ModelsPage() {
  return (
    <div className="space-y-6 animate-in">
      <div className="space-y-1">
        <h1 className="text-h1">Models</h1>
        <p className="text-body-muted">Forecasting models available in Kairos</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Prophet Card - Available */}
        <Card className="group relative overflow-hidden transition-all hover:shadow-soft-lg dark:hover:shadow-[0_8px_32px_rgba(0,194,185,0.08)]">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-teal-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:from-brand-cyan/5" />
          <CardHeader className="relative space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-teal-500/10 to-brand-teal-600/10 dark:from-brand-cyan/10 dark:to-brand-teal-600/10">
                <Sparkles className="h-5 w-5 text-brand-teal-600 dark:text-brand-cyan" aria-hidden />
              </div>
              <Badge variant="success">Available</Badge>
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg">Prophet</CardTitle>
              <CardDescription>
                Statistical forecasting model with trend + seasonality components.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="relative space-y-4">
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-brand-teal-500 dark:text-brand-cyan" aria-hidden />
                <span>Runs in Kairos via Augurs WASM (no Python)</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-brand-teal-500 dark:text-brand-cyan" aria-hidden />
                <span>Automatic seasonality detection</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-brand-teal-500 dark:text-brand-cyan" aria-hidden />
                <span>Configurable forecast horizons</span>
              </div>
            </div>
            <Button asChild className="w-full gap-2">
              <Link href="/forecasts">
                Create forecast
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Coming Soon Card */}
        <Card className="relative overflow-hidden opacity-60">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-transparent" />
          <CardHeader className="relative space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5">
                <Sparkles className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden />
              </div>
              <Badge variant="outline">Coming Soon</Badge>
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg text-slate-500 dark:text-slate-400">ARIMA</CardTitle>
              <CardDescription>
                Classic autoregressive integrated moving average for stationary series.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-sm text-slate-500 dark:text-slate-500">
              Additional forecasting models are in development and will be available in future releases.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
