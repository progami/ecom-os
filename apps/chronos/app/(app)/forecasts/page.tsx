import { ForecastsTable } from '@/components/forecasts/forecasts-table';
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

export default function ForecastsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-h1">Forecasts</h1>
        <p className="text-body">
          Create forecast projects, blend signals, and export outputs to X-Plan.
        </p>
      </div>

      <ForecastsTable data={demoForecasts} />
    </div>
  );
}

