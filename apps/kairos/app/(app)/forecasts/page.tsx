import { ForecastsTable } from '@/components/forecasts/forecasts-table';

export default function ForecastsPage() {
  return (
    <div className="space-y-8 animate-in">
      <div className="space-y-2">
        <div className="text-section-header">Workspace</div>
        <h1 className="text-h1">Forecasts</h1>
        <p className="text-body max-w-2xl">
          Create Prophet forecasts from imported time series. Run predictions with configurable horizons and view confidence intervals.
        </p>
      </div>

      <ForecastsTable />
    </div>
  );
}
