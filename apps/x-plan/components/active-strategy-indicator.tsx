'use client';

import { cn } from '@/lib/utils';

interface ActiveStrategyIndicatorProps {
  strategyName: string;
  region: 'US' | 'UK';
  assignee?: string | null;
  className?: string;
}

export function ActiveStrategyIndicator({
  strategyName,
  region,
  assignee,
  className,
}: ActiveStrategyIndicatorProps) {
  // Extract first name or email prefix for compact display
  const assigneeDisplay = assignee
    ? assignee.includes('@')
      ? assignee.split('@')[0]
      : assignee.split(' ')[0]
    : null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-slate-200/80 bg-gradient-to-r from-white to-slate-50/80 px-3.5 py-2 shadow-sm backdrop-blur-sm transition-all dark:border-[#1a3a54]/80 dark:from-[#0a1f33]/90 dark:to-[#0d2844]/80',
        className,
      )}
    >
      {/* Green pulse indicator */}
      <div className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 dark:bg-emerald-500" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] dark:bg-emerald-400 dark:shadow-[0_0_10px_rgba(52,211,153,0.4)]" />
      </div>

      {/* Strategy name */}
      <div className="flex min-w-0 flex-col gap-0">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Active Strategy
        </span>
        <span className="max-w-[180px] truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
          {strategyName}
        </span>
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-slate-200 dark:bg-[#1a3a54]" />

      {/* Region badge */}
      <div className="flex shrink-0 items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 dark:border-[#2a4a64] dark:bg-[#0a2438]">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          {region}
        </span>
      </div>

      {/* Assignee */}
      {assigneeDisplay && (
        <>
          <div className="h-8 w-px bg-slate-200 dark:bg-[#1a3a54]" />
          <div className="flex min-w-0 flex-col gap-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Assignee
            </span>
            <span className="max-w-[120px] truncate text-sm font-medium text-slate-700 dark:text-slate-200">
              {assigneeDisplay}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
