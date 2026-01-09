import { GoogleTrendsPanel } from '@/components/sources/google-trends-panel';

export default function SourcesPage() {
  return (
    <div className="space-y-8 animate-in">
      <div className="space-y-2">
        <div className="text-section-header">Import</div>
        <h1 className="text-h1">Data Sources</h1>
        <p className="text-body max-w-2xl">
          Bring external signals into Kairos as time series. Import Google Trends data to power your forecasts.
        </p>
      </div>
      <GoogleTrendsPanel />
    </div>
  );
}
