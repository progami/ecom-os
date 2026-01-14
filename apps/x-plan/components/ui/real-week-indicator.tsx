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
    <div className={cn('flex items-center gap-1 text-xs text-muted-foreground', className)}>
      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Actual data from Sellerboard" />
    </div>
  );
}
