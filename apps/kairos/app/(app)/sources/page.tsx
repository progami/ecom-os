import { DataSourcesPanel } from '@/components/sources/data-sources-panel';

export default function SourcesPage() {
  return (
    <div className="space-y-6 animate-in">
      <div className="space-y-1">
        <h1 className="text-h1">Sources</h1>
        <p className="text-body-muted">Import time series signals to use in forecasts</p>
      </div>
      <DataSourcesPanel />
    </div>
  );
}
