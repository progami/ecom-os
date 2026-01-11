import Link from 'next/link';
import { ArrowRight, Database, Sparkles } from 'lucide-react';

import { ForecastsTable } from '@/components/forecasts/forecasts-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForecastsPage() {
  return (
    <div className="space-y-6 animate-in">
      <div className="space-y-1">
        <h1 className="text-h1">Forecasts</h1>
        <p className="text-body-muted">
          Forecast future values for imported time series (e.g., Google Trends) and compare model runs.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Getting started</CardTitle>
          <CardDescription>Import a series, create a forecast, then run multiple models to compare.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>
              Import a time series from <span className="font-medium text-slate-700 dark:text-slate-200">Sources</span>.
            </li>
            <li>
              Create a forecast (horizon + default model) and run it.
            </li>
            <li>
              Open the forecast to run more models and compare runs in the history table.
            </li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link href="/sources">
                <Database className="h-4 w-4" aria-hidden />
                Go to Sources
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/models">
                <Sparkles className="h-4 w-4" aria-hidden />
                Model Library
              </Link>
            </Button>
            <Button asChild className="gap-2">
              <Link href="/sources">
                Import series
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      <ForecastsTable />
    </div>
  );
}
