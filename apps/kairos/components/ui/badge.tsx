import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ForecastStatus } from '@/types/kairos';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-teal-500/50 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-brand-teal-500/10 text-brand-teal-700 dark:bg-brand-cyan/15 dark:text-brand-cyan',
        secondary:
          'border-transparent bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300',
        destructive:
          'border-transparent bg-danger-100 text-danger-700 dark:bg-danger-950 dark:text-danger-400',
        outline: 'border-slate-300 text-slate-600 dark:border-white/20 dark:text-slate-400',
        success:
          'border-transparent bg-success-100 text-success-700 dark:bg-success-950 dark:text-success-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const statusStyles: Record<ForecastStatus, string> = {
  DRAFT: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400',
  READY: 'border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-900 dark:text-success-300',
  RUNNING: 'border-brand-teal-200 bg-brand-teal-50 text-brand-teal-700 dark:border-brand-cyan/30 dark:bg-brand-cyan/15 dark:text-brand-cyan',
  FAILED: 'border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-500/30 dark:bg-danger-900 dark:text-danger-300',
};

const statusIcons: Record<ForecastStatus, React.ReactNode> = {
  DRAFT: <Clock className="h-3 w-3" aria-hidden />,
  READY: <CheckCircle className="h-3 w-3" aria-hidden />,
  RUNNING: <Loader2 className="h-3 w-3 animate-spin" aria-hidden />,
  FAILED: <AlertCircle className="h-3 w-3" aria-hidden />,
};

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: ForecastStatus;
}

function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium',
        statusStyles[status],
        className,
      )}
      {...props}
    >
      {statusIcons[status]}
      <span className="capitalize">{status.toLowerCase()}</span>
    </div>
  );
}

export { Badge, badgeVariants, StatusBadge };

