'use client';

import { cn } from '@/lib/utils';

interface ActiveStrategyIndicatorProps {
  strategyName: string;
  className?: string;
}

export function ActiveStrategyIndicator({
  strategyName,
  className,
}: ActiveStrategyIndicatorProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg border border-slate-200/80 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur-sm dark:border-[#1a3a54]/80 dark:bg-[#0a1f33]/90',
        className,
      )}
    >
      {/* Green pulse indicator */}
      <div className="relative flex h-2 w-2 shrink-0 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 dark:bg-emerald-500" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)] dark:bg-emerald-400 dark:shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
      </div>

      {/* Strategy name */}
      <span className="max-w-[200px] truncate text-sm font-medium text-slate-700 dark:text-slate-200">
        {strategyName}
      </span>
    </div>
  );
}
