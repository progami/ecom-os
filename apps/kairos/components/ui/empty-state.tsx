import * as React from 'react';
import { BarChart3, Database, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from './button';

type IllustrationType = 'forecasts' | 'data' | 'models';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  illustration?: IllustrationType;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
}

const illustrations: Record<IllustrationType, React.ReactNode> = {
  forecasts: (
    <div className="relative mx-auto mb-6 h-28 w-28">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-20 w-20 rounded-2xl bg-brand-teal-100 dark:bg-brand-cyan/10" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <BarChart3 className="h-10 w-10 text-brand-teal-500 dark:text-brand-cyan" />
      </div>
      <div className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-brand-teal-200 dark:bg-brand-cyan/20" />
      <div className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full bg-brand-teal-300 dark:bg-brand-cyan/30" />
    </div>
  ),
  data: (
    <div className="relative mx-auto mb-6 h-28 w-28">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-20 w-20 rounded-2xl bg-success-100 dark:bg-success-950" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Database className="h-10 w-10 text-success-600 dark:text-success-400" />
      </div>
      <div className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-success-200 dark:bg-success-800" />
      <div className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full bg-success-300 dark:bg-success-700" />
    </div>
  ),
  models: (
    <div className="relative mx-auto mb-6 h-28 w-28">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-20 w-20 rounded-2xl bg-accent-100 dark:bg-accent-950" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Sparkles className="h-10 w-10 text-accent-600 dark:text-accent-400" />
      </div>
      <div className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-accent-200 dark:bg-accent-800" />
      <div className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full bg-accent-300 dark:bg-accent-700" />
    </div>
  ),
};

function EmptyState({
  illustration,
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        className,
      )}
      {...props}
    >
      {illustration && illustrations[illustration]}
      {icon && !illustration && (
        <div className="mb-4 rounded-2xl bg-slate-100 p-4 dark:bg-white/5">{icon}</div>
      )}
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-6 gap-2">
          {action.icon}
          {action.label}
        </Button>
      )}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps, IllustrationType };
