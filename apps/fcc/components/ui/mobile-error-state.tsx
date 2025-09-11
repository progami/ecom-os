'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileErrorStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function MobileErrorState({
  icon: Icon,
  title,
  description,
  action,
  className
}: MobileErrorStateProps) {
  return (
    <div className={cn(
      "bg-secondary backdrop-blur-sm border border-default rounded-2xl",
      "p-6 sm:p-8 text-center",
      className
    )}>
      <Icon className="h-10 w-10 sm:h-12 sm:w-12 text-brand-red mx-auto mb-3 sm:mb-4" />
      <h3 className="text-base sm:text-lg font-semibold text-white mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-xs sm:text-sm text-slate-400 mb-4 max-w-md mx-auto">
          {description}
        </p>
      )}
      {action && (
        <button 
          onClick={action.onClick}
          className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg transition-colors text-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}