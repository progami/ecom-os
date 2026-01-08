import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const models = [
  {
    id: 'prophet',
    name: 'Prophet',
    description: 'Baseline forecasting model with seasonality and holiday effects.',
    status: 'available' as const,
  },
  {
    id: 'signal_blend',
    name: 'Signal Blend',
    description: 'Blend Amazon signals + Google Trends into the Prophet baseline.',
    status: 'planned' as const,
  },
];

export default function ModelsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-h1">Models</h1>
        <p className="text-body">Choose how Chronos generates and blends forecasts.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {models.map((model) => (
          <Card key={model.id}>
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">{model.name}</CardTitle>
                  <CardDescription>{model.description}</CardDescription>
                </div>
                <Badge variant={model.status === 'available' ? 'default' : 'outline'}>
                  {model.status === 'available' ? 'Available' : 'Planned'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button className="w-full" disabled={model.status !== 'available'}>
                Configure
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

