'use client';

import { cn } from '@/lib/utils';

type RealWeekIndicatorProps = {
  hasActualData: boolean;
  className?: string;
};

export function RealWeekIndicator({ hasActualData, className }: RealWeekIndicatorProps) {
  if (!hasActualData) return null;

  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full bg-emerald-500',
        className
      )}
      title="Actual data from Sellerboard"
    />
  );
}

type WeekIndicatorLegendProps = {
  className?: string;
};

export function WeekIndicatorLegend({ className }: WeekIndicatorLegendProps) {
  return (
    <div className={cn('flex items-center gap-4 text-xs text-muted-foreground', className)}>
      <div className="flex items-center gap-1.5">
        <span className="inline-flex h-5 w-8 items-center justify-center rounded border bg-cyan-100 text-2xs font-medium dark:bg-cyan-900/50">
          W1
        </span>
        <span>Actual data from Sellerboard</span>
      </div>
    </div>
  );
}
