import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type SourceStatus = 'connected' | 'not_connected' | 'needs_attention';

const sources: Array<{
  id: string;
  name: string;
  description: string;
  status: SourceStatus;
  lastSyncAt?: string | null;
}> = [
  {
    id: 'amazon_brand_analytics',
    name: 'Amazon Brand Analytics',
    description: 'Search terms, conversion signals, and brand-level demand indicators.',
    status: 'not_connected',
    lastSyncAt: null,
  },
  {
    id: 'amazon_product_guidance',
    name: 'Amazon Product Guidance',
    description: 'Marketplace guidance and product-level demand hints.',
    status: 'not_connected',
    lastSyncAt: null,
  },
  {
    id: 'google_trends',
    name: 'Google Trends',
    description: 'External demand intent signals for brand and category keywords.',
    status: 'connected',
    lastSyncAt: '2026-01-07T15:05:00.000Z',
  },
];

function statusBadge(status: SourceStatus) {
  switch (status) {
    case 'connected':
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">Connected</Badge>;
    case 'needs_attention':
      return <Badge className="bg-amber-600 hover:bg-amber-600">Needs attention</Badge>;
    case 'not_connected':
      return (
        <Badge variant="outline" className="border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300">
          Not connected
        </Badge>
      );
  }
}

export default function SourcesPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-h1">Data Sources</h1>
        <p className="text-body">Connect the signals that power Chronos forecasts.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sources.map((source) => (
          <Card key={source.id}>
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">{source.name}</CardTitle>
                  <CardDescription>{source.description}</CardDescription>
                </div>
                {statusBadge(source.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Last sync:{' '}
                {source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleString() : '—'}
              </div>
              <Button variant={source.status === 'connected' ? 'outline' : 'default'} className="w-full">
                {source.status === 'connected' ? 'Manage connection' : 'Connect'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

