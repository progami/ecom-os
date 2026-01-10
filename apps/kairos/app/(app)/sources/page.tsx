import { GoogleTrendsPanel } from '@/components/sources/google-trends-panel';

export default function SourcesPage() {
  return (
    <div className="space-y-6 animate-in">
      <div className="space-y-1">
        <h1 className="text-h1">Sources</h1>
        <p className="text-body-muted">Import time series from external data sources</p>
      </div>
      <GoogleTrendsPanel />
    </div>
  );
}
