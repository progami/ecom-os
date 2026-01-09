import { GoogleTrendsPanel } from '@/components/sources/google-trends-panel';

export default function SourcesPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-h1">Data Sources</h1>
        <p className="text-body">Bring external signals into Chronos as time series.</p>
      </div>
      <GoogleTrendsPanel />
    </div>
  );
}
