'use client';

import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
  RadialLinearScale,
  Filler,
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Filler,
  Title,
  Tooltip,
  Legend
);

interface ChartComponentProps {
  type: 'line' | 'bar' | 'doughnut' | 'pie' | 'radar';
  data: ChartData<'line' | 'bar' | 'doughnut' | 'pie' | 'radar'>;
  options?: ChartOptions<'line' | 'bar' | 'doughnut' | 'pie' | 'radar'>;
  height?: number;
}

export default function ChartComponent({ type, data, options, height = 300 }: ChartComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Create new chart
    chartRef.current = new ChartJS(ctx, {
      type: type as any,
      data: data as any,
      options: ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top' as const,
          },
          title: {
            display: false,
          },
        },
        ...options,
      } as any),
    } as any);

    // Cleanup on unmount
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [type, data, options]);

  return (
    <div style={{ height: `${height}px` }}>
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}