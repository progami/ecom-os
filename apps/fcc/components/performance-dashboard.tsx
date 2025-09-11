'use client';

import { useState, useEffect } from 'react';
import { performanceMonitor } from '@/lib/performance-monitor';
import { Activity, Zap, Clock, BarChart3, TrendingUp } from 'lucide-react';

interface PerformanceMetrics {
  pageLoad?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  firstInputDelay?: number;
  cumulativeLayoutShift?: number;
  timeToInteractive?: number;
  totalBlockingTime?: number;
}

interface ComponentStats {
  [key: string]: {
    avgRenderTime: number;
    renderCount: number;
    slowRenders: number;
  };
}

export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({});
  const [componentStats, setComponentStats] = useState<ComponentStats>({});
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Update metrics periodically
    const updateMetrics = () => {
      setMetrics(performanceMonitor.getMetrics());
      setComponentStats(performanceMonitor.getComponentStats());
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);

    return () => clearInterval(interval);
  }, []);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const getMetricStatus = (value: number | undefined, goodThreshold: number, poorThreshold: number) => {
    if (!value) return 'text-slate-400';
    if (value <= goodThreshold) return 'text-brand-emerald';
    if (value <= poorThreshold) return 'text-brand-amber';
    return 'text-brand-red';
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 left-4 z-50 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg shadow-lg transition-all"
        title="Performance Dashboard"
      >
        <Activity className="h-5 w-5 text-white" />
      </button>

      {/* Dashboard Panel */}
      {isOpen && (
        <div className="fixed bottom-20 left-4 z-50 w-96 max-h-[600px] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Performance Dashboard</span>
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ×
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[500px]">
            {/* Core Web Vitals */}
            <div className="p-4 border-b border-slate-700">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
                <Zap className="h-4 w-4" />
                <span>Core Web Vitals</span>
              </h4>
              <div className="space-y-2">
                {/* LCP */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">LCP</span>
                  <span className={`text-sm font-mono ${getMetricStatus(metrics.largestContentfulPaint, 2500, 4000)}`}>
                    {metrics.largestContentfulPaint ? `${metrics.largestContentfulPaint.toFixed(0)}ms` : '-'}
                  </span>
                </div>
                
                {/* FID */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">FID</span>
                  <span className={`text-sm font-mono ${getMetricStatus(metrics.firstInputDelay, 100, 300)}`}>
                    {metrics.firstInputDelay ? `${metrics.firstInputDelay.toFixed(0)}ms` : '-'}
                  </span>
                </div>
                
                {/* CLS */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">CLS</span>
                  <span className={`text-sm font-mono ${getMetricStatus(metrics.cumulativeLayoutShift, 0.1, 0.25)}`}>
                    {metrics.cumulativeLayoutShift ? metrics.cumulativeLayoutShift.toFixed(3) : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Other Metrics */}
            <div className="p-4 border-b border-slate-700">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Performance Metrics</span>
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">Page Load</span>
                  <span className="text-sm font-mono text-slate-400">
                    {metrics.pageLoad ? `${metrics.pageLoad.toFixed(0)}ms` : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">FCP</span>
                  <span className="text-sm font-mono text-slate-400">
                    {metrics.firstContentfulPaint ? `${metrics.firstContentfulPaint.toFixed(0)}ms` : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">TTI</span>
                  <span className="text-sm font-mono text-slate-400">
                    {metrics.timeToInteractive ? `${metrics.timeToInteractive.toFixed(0)}ms` : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300">TBT</span>
                  <span className="text-sm font-mono text-slate-400">
                    {metrics.totalBlockingTime ? `${metrics.totalBlockingTime.toFixed(0)}ms` : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Component Performance */}
            <div className="p-4">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
                <BarChart3 className="h-4 w-4" />
                <span>Component Performance</span>
              </h4>
              <div className="space-y-2">
                {Object.entries(componentStats).map(([name, stats]) => (
                  <div key={name} className="bg-slate-800 rounded p-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-white">{name}</span>
                      <span className={`text-xs ${stats.slowRenders > 0 ? 'text-brand-amber' : 'text-brand-emerald'}`}>
                        {stats.slowRenders} slow
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>Avg: {stats.avgRenderTime.toFixed(1)}ms</span>
                      <span>Renders: {stats.renderCount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-slate-700 bg-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Performance monitoring active</span>
              <TrendingUp className="h-3 w-3" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}