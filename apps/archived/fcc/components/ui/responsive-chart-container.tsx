'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveChartContainerProps {
  children: React.ReactNode;
  className?: string;
  minHeight?: number;
  mobileHeight?: number;
  tabletHeight?: number;
}

export function ResponsiveChartContainer({
  children,
  className,
  minHeight = 300,
  mobileHeight = 250,
  tabletHeight = 280
}: ResponsiveChartContainerProps) {
  const [height, setHeight] = useState(minHeight);

  useEffect(() => {
    const updateHeight = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setHeight(mobileHeight);
      } else if (width < 768) {
        setHeight(tabletHeight);
      } else {
        setHeight(minHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [minHeight, mobileHeight, tabletHeight]);

  return (
    <div className={cn('relative', className)} style={{ height: `${height}px` }}>
      {children}
    </div>
  );
}