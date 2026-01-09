import { ForecastsTable } from '@/components/forecasts/forecasts-table';

export default function ForecastsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-h1">Forecasts</h1>
        <p className="text-body">
          Create Prophet forecasts from imported time series.
        </p>
      </div>

      <ForecastsTable />
    </div>
  );
}
