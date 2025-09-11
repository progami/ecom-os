import React from 'react';
import { SkeletonChart } from '@/components/ui/skeleton-chart';

interface ReportChartsGridProps {
  children: React.ReactNode;
  loading?: boolean;
  columns?: 1 | 2;
}

export function ReportChartsGrid({ 
  children, 
  loading = false,
  columns = 2 
}: ReportChartsGridProps) {
  if (loading) {
    return (
      <div className={`grid grid-cols-1 ${columns === 2 ? 'lg:grid-cols-2' : ''} gap-6`}>
        {Array.from({ length: columns }).map((_, index) => (
          <div key={index} className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-6">
            <SkeletonChart />
          </div>
        ))}
      </div>
    );
  }

  const childrenArray = React.Children.toArray(children);

  return (
    <div className={`grid grid-cols-1 ${columns === 2 ? 'lg:grid-cols-2' : ''} gap-6`}>
      {childrenArray.map((child, index) => (
        <div key={index} className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-6">
          {child}
        </div>
      ))}
    </div>
  );
}