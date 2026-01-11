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
        'flex items-center gap-1 rounded border border-slate-200/80 bg-white/90 px-1.5 py-0.5 shadow-sm backdrop-blur-sm dark:border-[#1a3a54]/80 dark:bg-[#0a1f33]/90',
        className,
      )}
    >
      {/* Green pulse indicator */}
      <div className="relative flex h-1.5 w-1.5 shrink-0 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 dark:bg-emerald-500" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)] dark:bg-emerald-400 dark:shadow-[0_0_6px_rgba(52,211,153,0.4)]" />
      </div>

      {/* Strategy name */}
      <span className="max-w-[140px] truncate text-[11px] font-medium text-slate-600 dark:text-slate-300">
        {strategyName}
      </span>
    </div>
  );
}
