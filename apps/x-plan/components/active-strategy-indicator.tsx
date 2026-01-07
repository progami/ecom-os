'use client';

import { cn } from '@/lib/utils';

interface ActiveStrategyIndicatorProps {
  strategyName: string;
  className?: string;
}

export function ActiveStrategyIndicator({ strategyName, className }: ActiveStrategyIndicatorProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur-sm transition-all dark:border-[#1a3a54] dark:bg-[#0a1f33]/80',
        className,
      )}
    >
      {/* Green pulse indicator */}
      <div className="relative flex h-2.5 w-2.5 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 dark:bg-emerald-500" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
      </div>

      {/* Strategy label and name */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Strategy
        </span>
        <span className="max-w-[180px] truncate text-sm font-medium text-slate-700 dark:text-slate-200">
          {strategyName}
        </span>
      </div>
    </div>
  );
}
