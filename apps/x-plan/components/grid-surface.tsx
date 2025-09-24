'use client';

import { clsx } from 'clsx';
import type { HTMLAttributes } from 'react';

interface GridSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  contentClassName?: string;
}

export function GridSurface({ children, className, contentClassName, ...props }: GridSurfaceProps) {
  return (
    <div
      {...props}
      className={clsx(
        'x-plan-grid-surface relative overflow-hidden rounded-3xl border border-slate-200/60 bg-gradient-to-br from-white/95 via-slate-50/95 to-slate-100/80 shadow-[0_30px_60px_-45px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-white/10 dark:from-slate-950/85 dark:via-slate-900/80 dark:to-slate-950/70 dark:shadow-[0_40px_70px_-45px_rgba(15,23,42,0.9)]',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-[-10%] h-72 w-72 rounded-full bg-gradient-to-br from-purple-500/25 via-blue-500/20 to-transparent blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 left-[-5%] h-80 w-80 rounded-full bg-gradient-to-br from-cyan-400/25 via-sky-500/15 to-transparent blur-3xl"
      />
      <div className={clsx('relative z-10 flex flex-col gap-6 p-6 sm:p-8', contentClassName)}>
        {children}
      </div>
    </div>
  );
}
