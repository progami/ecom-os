'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MobileReportLayoutProps {
  children: ReactNode;
  className?: string;
}

export function MobileReportLayout({ children, className }: MobileReportLayoutProps) {
  return (
    <div className={cn("min-h-screen bg-background", className)}>
      {/* Mobile-optimized container with proper padding */}
      <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {children}
      </div>
    </div>
  );
}

interface ReportSectionProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function ReportSection({ 
  title, 
  subtitle, 
  children, 
  className,
  actions 
}: ReportSectionProps) {
  return (
    <section className={cn("mb-6 sm:mb-8", className)}>
      {(title || subtitle || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4">
          <div>
            {title && (
              <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-white">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

interface MetricGridProps {
  children: ReactNode;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  className?: string;
}

export function MetricGrid({ 
  children, 
  columns = { mobile: 2, tablet: 2, desktop: 4 },
  className 
}: MetricGridProps) {
  const gridClasses = cn(
    "grid gap-3 sm:gap-4 lg:gap-6",
    {
      [`grid-cols-${columns.mobile}`]: columns.mobile,
      [`sm:grid-cols-${columns.tablet}`]: columns.tablet,
      [`lg:grid-cols-${columns.desktop}`]: columns.desktop,
    },
    className
  );

  return <div className={gridClasses}>{children}</div>;
}

interface ChartGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

export function ChartGrid({ 
  children, 
  columns = 2,
  className 
}: ChartGridProps) {
  const gridClasses = cn(
    "grid gap-4 sm:gap-6",
    {
      "grid-cols-1": columns === 1,
      "grid-cols-1 lg:grid-cols-2": columns === 2,
      "grid-cols-1 md:grid-cols-2 lg:grid-cols-3": columns === 3,
    },
    className
  );

  return <div className={gridClasses}>{children}</div>;
}

interface MobileTableWrapperProps {
  children: ReactNode;
  className?: string;
}

export function MobileTableWrapper({ children, className }: MobileTableWrapperProps) {
  return (
    <div className={cn(
      "overflow-x-auto -mx-3 sm:-mx-4 md:mx-0",
      className
    )}>
      <div className="min-w-full inline-block align-middle px-3 sm:px-4 md:px-0">
        {children}
      </div>
    </div>
  );
}

// Export utilities for responsive chart heights
export const chartHeights = {
  small: { mobile: 200, tablet: 250, desktop: 300 },
  medium: { mobile: 250, tablet: 300, desktop: 350 },
  large: { mobile: 300, tablet: 350, desktop: 400 },
} as const;

// Export responsive padding utilities
export const responsivePadding = {
  card: "p-3 sm:p-4 lg:p-6",
  section: "py-4 sm:py-6 lg:py-8",
  compact: "p-2 sm:p-3 lg:p-4",
} as const;