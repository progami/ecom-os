import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ModelsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-h1">Models</h1>
        <p className="text-body">Choose how Chronos generates and blends forecasts.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-base">Prophet</CardTitle>
                <CardDescription>
                  Statistical forecasting model with trend + seasonality. Runs in-app via Augurs (WASM).
                </CardDescription>
              </div>
              <Badge>Available</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Prophet is the default Chronos model today. Create a forecast to run it against any imported time series.
            </div>
            <Button asChild className="w-full">
              <Link href="/forecasts">Create forecast</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
