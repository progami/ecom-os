import Link from 'next/link';
import { ArrowRight, BarChart3, Database, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type KairosStepId = 'sources' | 'forecasts' | 'models';

type StepDef = {
  id: KairosStepId;
  step: string;
  title: string;
  description: string;
  href: string;
  icon: typeof Database;
};

const STEPS: StepDef[] = [
  {
    id: 'sources',
    step: 'Step 1',
    title: 'Import signals',
    description: 'Bring external data (Google Trends) into Kairos as time series.',
    href: '/sources',
    icon: Database,
  },
  {
    id: 'forecasts',
    step: 'Step 2',
    title: 'Create forecasts',
    description: 'Create a Prophet forecast from any imported series and choose a horizon.',
    href: '/forecasts',
    icon: BarChart3,
  },
  {
    id: 'models',
    step: 'Optional',
    title: 'Model library',
    description: 'See which models Kairos supports now (Prophet) and what’s coming next.',
    href: '/models',
    icon: Sparkles,
  },
];

export function GettingStartedCard({ active }: { active?: KairosStepId }) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Recommended flow</CardTitle>
        <CardDescription>
          Start with importing a time series, then create a forecast. Models is a reference tab.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3">
          {STEPS.map((step) => {
            const isActive = active === step.id;
            const Icon = step.icon;

            return (
              <div
                key={step.id}
                className={cn(
                  'rounded-xl border p-4',
                  isActive
                    ? 'border-brand-teal-500/20 bg-brand-teal-500/5 dark:border-brand-cyan/30 dark:bg-brand-cyan/10'
                    : 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/5',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl',
                        isActive
                          ? 'bg-brand-teal-500/10 text-brand-teal-700 dark:bg-brand-cyan/15 dark:text-brand-cyan'
                          : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {step.title}
                      </div>
                      <Badge variant={step.step === 'Optional' ? 'outline' : 'secondary'} className="text-[10px]">
                        {step.step}
                      </Badge>
                    </div>
                  </div>

                  <Button
                    asChild
                    size="sm"
                    variant={isActive ? 'secondary' : 'outline'}
                    className="shrink-0 gap-1"
                  >
                    <Link href={step.href}>
                      Open
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                </div>

                <p className="mt-3 text-sm text-muted-foreground">{step.description}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
