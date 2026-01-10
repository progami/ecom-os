'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Loading placeholder for charts
function ChartLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Skeleton className="h-full w-full" />
    </div>
  );
}

// Lazy load heavy chart components to improve initial page load
type RechartComponentProps = Record<string, unknown>;

const createLazyChart = (chartName: string) =>
  dynamic<RechartComponentProps>(
    () => import('recharts').then((mod) => mod[chartName] as ComponentType<RechartComponentProps>),
    {
      ssr: false,
      loading: ChartLoading,
    },
  );

// Lazy loaded chart components
export const AreaChart = createLazyChart('AreaChart');
export const LineChart = createLazyChart('LineChart');
export const ComposedChart = createLazyChart('ComposedChart');

// Re-export lightweight components directly
export {
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
