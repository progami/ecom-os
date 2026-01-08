import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ForecastProject } from '@/types/forecast';

const demoForecasts: ForecastProject[] = [
  {
    id: 'fp_demo_001',
    name: 'US | Core SKU Forecast',
    marketplace: 'US',
    horizonWeeks: 26,
    frequency: 'Weekly',
    sources: ['Amazon Brand Analytics', 'Amazon Product Guidance', 'Google Trends'],
    model: 'Prophet',
    lastRunAt: '2026-01-07T18:22:00.000Z',
    status: 'ready',
  },
  {
    id: 'fp_demo_002',
    name: 'CA | New Launch Ramp',
    marketplace: 'CA',
    horizonWeeks: 18,
    frequency: 'Weekly',
    sources: ['Google Trends'],
    model: 'Prophet',
    lastRunAt: null,
    status: 'draft',
  },
  {
    id: 'fp_demo_003',
    name: 'UK | Peak Season Blend',
    marketplace: 'UK',
    horizonWeeks: 32,
    frequency: 'Weekly',
    sources: ['Amazon Brand Analytics', 'Google Trends'],
    model: 'Prophet',
    lastRunAt: '2026-01-06T09:10:00.000Z',
    status: 'running',
  },
];

export default async function ForecastDetailPage({
  params,
}: {
  params: Promise<{ forecastId: string }>;
}) {
  const { forecastId } = await params;
  const forecast = demoForecasts.find((item) => item.id === forecastId);
  if (!forecast) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h1">{forecast.name}</h1>
            <Badge variant="secondary">{forecast.marketplace}</Badge>
            <Badge variant={forecast.status === 'ready' ? 'default' : 'outline'}>{forecast.status}</Badge>
          </div>
          <p className="text-body">
            {forecast.model} • {forecast.frequency} • {forecast.horizonWeeks} weeks
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/forecasts">Back to Forecasts</Link>
          </Button>
          <Button>Export to X-Plan</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Signals</CardTitle>
            <CardDescription>Inputs that will be blended into the forecast.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {forecast.sources.map((source) => (
              <Badge key={source} variant="outline">
                {source}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export</CardTitle>
            <CardDescription>Send outputs to an X-Plan sheet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Exports are stubbed in this foundation build.
            </div>
            <Button className="w-full">Queue Export</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

