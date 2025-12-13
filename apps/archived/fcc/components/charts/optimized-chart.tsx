'use client';

import React, { memo, useRef, useEffect, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useIntersectionObserver } from '@/hooks/use-intersection-observer';
import { SkeletonChart } from '@/components/ui/skeleton';

// Lazy load recharts components
const ResponsiveContainer = dynamic(
  () => import('recharts').then(mod => mod.ResponsiveContainer),
  { ssr: false, loading: () => <SkeletonChart height={300} /> }
);

const AreaChart = dynamic(
  () => import('recharts').then(mod => mod.AreaChart),
  { ssr: false }
);

const BarChart = dynamic(
  () => import('recharts').then(mod => mod.BarChart),
  { ssr: false }
);

const LineChart = dynamic(
  () => import('recharts').then(mod => mod.LineChart),
  { ssr: false }
);

const PieChart = dynamic(
  () => import('recharts').then(mod => mod.PieChart),
  { ssr: false }
);

const ComposedChart = dynamic(
  () => import('recharts').then(mod => mod.ComposedChart),
  { ssr: false }
);

// Export other necessary components
export const Area = dynamic(() => import('recharts').then(mod => mod.Area), { ssr: false });
export const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false });
export const Line = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false });
export const Pie = dynamic(() => import('recharts').then(mod => mod.Pie), { ssr: false });
export const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false });
export const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
export const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
export const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
export const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
export const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false });

interface OptimizedChartProps {
  type: 'area' | 'bar' | 'line' | 'pie' | 'composed';
  data: any[];
  height?: number;
  width?: string | number;
  children: React.ReactNode;
  lazyLoad?: boolean;
  priority?: boolean;
}

// Memoized chart wrapper with lazy loading support
export const OptimizedChart = memo(({
  type,
  data,
  height = 300,
  width = '100%',
  children,
  lazyLoad = true,
  priority = false,
}: OptimizedChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(priority || !lazyLoad);
  const isIntersecting = useIntersectionObserver(containerRef, {
    threshold: 0.1,
    rootMargin: '50px',
  });

  useEffect(() => {
    if (isIntersecting && !isLoaded) {
      setIsLoaded(true);
    }
  }, [isIntersecting, isLoaded]);

  const ChartComponent = {
    area: AreaChart,
    bar: BarChart,
    line: LineChart,
    pie: PieChart,
    composed: ComposedChart,
  }[type];

  return (
    <div ref={containerRef} style={{ width, height }}>
      {isLoaded ? (
        <Suspense fallback={<SkeletonChart height={height} />}>
          <ResponsiveContainer width="100%" height={height}>
            <ChartComponent data={data}>
              {children}
            </ChartComponent>
          </ResponsiveContainer>
        </Suspense>
      ) : (
        <SkeletonChart height={height} />
      )}
    </div>
  );
});

OptimizedChart.displayName = 'OptimizedChart';

// Chart configuration helpers with memoization
export const useChartConfig = memo(({
  strokeDasharray = '3 3',
  strokeColor = '#374151',
  axisColor = '#9CA3AF',
  fontSize = 11,
}: {
  strokeDasharray?: string;
  strokeColor?: string;
  axisColor?: string;
  fontSize?: number;
} = {}) => {
  return {
    grid: {
      strokeDasharray,
      stroke: strokeColor,
    },
    axis: {
      stroke: axisColor,
      tick: { fontSize },
    },
    tooltip: {
      contentStyle: {
        backgroundColor: '#1e293b',
        border: '1px solid #475569',
        borderRadius: '8px',
      },
    },
    legend: {
      wrapperStyle: { color: '#fff' },
    },
  };
});

useChartConfig.displayName = 'useChartConfig';

// Virtualized chart for large datasets
export const VirtualizedChart = memo(({
  data,
  visibleItems = 50,
  ...props
}: OptimizedChartProps & { visibleItems?: number }) => {
  const [displayData, setDisplayData] = useState(data.slice(0, visibleItems));
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (data.length <= visibleItems) {
      setDisplayData(data);
      return;
    }

    const endIndex = Math.min(currentIndex + visibleItems, data.length);
    setDisplayData(data.slice(currentIndex, endIndex));
  }, [data, currentIndex, visibleItems]);

  const handleScroll = (direction: 'forward' | 'backward') => {
    if (direction === 'forward') {
      setCurrentIndex(prev => Math.min(prev + visibleItems, data.length - visibleItems));
    } else {
      setCurrentIndex(prev => Math.max(prev - visibleItems, 0));
    }
  };

  return (
    <div>
      <OptimizedChart {...props} data={displayData} />
      {data.length > visibleItems && (
        <div className="flex justify-center space-x-2 mt-2">
          <button
            onClick={() => handleScroll('backward')}
            disabled={currentIndex === 0}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
          >
            Previous
          </button>
          <span className="text-sm text-slate-400 py-1">
            {currentIndex + 1} - {Math.min(currentIndex + visibleItems, data.length)} of {data.length}
          </span>
          <button
            onClick={() => handleScroll('forward')}
            disabled={currentIndex + visibleItems >= data.length}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
});

VirtualizedChart.displayName = 'VirtualizedChart';