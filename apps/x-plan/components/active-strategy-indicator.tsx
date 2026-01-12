'use client';

import { cn } from '@/lib/utils';

interface ActiveStrategyIndicatorProps {
  strategyName: string;
  className?: string;
}

export function ActiveStrategyIndicator({ strategyName, className }: ActiveStrategyIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-1 px-1 py-px', className)}>
      {/* Green pulse indicator */}
      <div className="relative flex h-1.5 w-1.5 shrink-0 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 dark:bg-emerald-500" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
      </div>

      {/* Strategy name */}
      <span className="max-w-[120px] truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
        {strategyName}
      </span>
    </div>
  );
}
