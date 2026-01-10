import { ForecastsTable } from '@/components/forecasts/forecasts-table';

export default function ForecastsPage() {
  return (
    <div className="space-y-6 animate-in">
      <div className="space-y-1">
        <h1 className="text-h1">Forecasts</h1>
        <p className="text-body-muted">Forecasts from imported time series (Prophet, ETS)</p>
      </div>
      <ForecastsTable />
    </div>
  );
}
