'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';

interface FilterContainerProps {
  children: React.ReactNode;
  onReset?: () => void;
  className?: string;
  showReset?: boolean;
  title?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export function FilterContainer({
  children,
  onReset,
  className,
  showReset = true,
  title = 'Filters',
  collapsible = true,
  defaultExpanded = true,
}: FilterContainerProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {showReset && onReset && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-8 px-2 text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
          {collapsible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 px-2"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          )}
        </div>
      </div>
      {(!collapsible || isExpanded) && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {children}
        </div>
      )}
    </div>
  );
}

interface FilterGroupProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function FilterGroup({ label, children, className }: FilterGroupProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}