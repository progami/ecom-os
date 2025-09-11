import React from 'react';
import { MetricCard } from '@/components/ui/metric-card';
import { SkeletonCard } from '@/components/ui/skeleton-card';

export interface ReportMetric {
  title: string;
  value: string | number;
  description?: string;
  change?: number;
  changeLabel?: string;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  icon?: React.ReactNode;
}

interface ReportMetricsGridProps {
  metrics: ReportMetric[];
  loading?: boolean;
  columns?: 1 | 2 | 3 | 4;
}

const getGridColumns = (columns: number) => {
  switch (columns) {
    case 1:
      return 'grid-cols-1';
    case 2:
      return 'grid-cols-1 md:grid-cols-2';
    case 3:
      return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    case 4:
    default:
      return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
  }
};

export function ReportMetricsGrid({ 
  metrics, 
  loading = false,
  columns = 4 
}: ReportMetricsGridProps) {
  if (loading) {
    return (
      <div className={`grid ${getGridColumns(columns)} gap-6`}>
        {Array.from({ length: columns }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid ${getGridColumns(columns)} gap-6`}>
      {metrics.map((metric, index) => (
        <MetricCard
          key={index}
          title={metric.title}
          value={metric.value}
          description={metric.description}
          change={metric.change}
          changeLabel={metric.changeLabel}
          variant={metric.variant}
          icon={metric.icon}
        />
      ))}
    </div>
  );
}