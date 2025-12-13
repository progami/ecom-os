// Performance monitoring utility
import React from 'react';

interface PerformanceMetrics {
  pageLoad?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  firstInputDelay?: number;
  cumulativeLayoutShift?: number;
  timeToInteractive?: number;
  totalBlockingTime?: number;
}

interface ComponentRenderMetrics {
  componentName: string;
  renderTime: number;
  props?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};
  private componentMetrics: Map<string, ComponentRenderMetrics[]> = new Map();
  private observers: PerformanceObserver[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeObservers();
      this.capturePageLoadMetrics();
    }
  }

  private initializeObservers() {
    // Observe Largest Contentful Paint
    try {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        this.metrics.largestContentfulPaint = lastEntry.renderTime || lastEntry.loadTime;
        this.logMetric('LCP', this.metrics.largestContentfulPaint);
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      this.observers.push(lcpObserver);
    } catch (e) {
      console.warn('LCP observer not supported', e);
    }

    // Observe First Input Delay
    try {
      const fidObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const firstInput = entries[0] as any;
        this.metrics.firstInputDelay = firstInput.processingStart - firstInput.startTime;
        this.logMetric('FID', this.metrics.firstInputDelay);
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
      this.observers.push(fidObserver);
    } catch (e) {
      console.warn('FID observer not supported', e);
    }

    // Observe Cumulative Layout Shift
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        this.metrics.cumulativeLayoutShift = clsValue;
        this.logMetric('CLS', clsValue);
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      this.observers.push(clsObserver);
    } catch (e) {
      console.warn('CLS observer not supported', e);
    }
  }

  private capturePageLoadMetrics() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navigation) {
          this.metrics.pageLoad = navigation.loadEventEnd - navigation.fetchStart;
          this.metrics.firstContentfulPaint = navigation.domContentLoadedEventEnd - navigation.fetchStart;
          this.metrics.timeToInteractive = navigation.domInteractive - navigation.fetchStart;
          
          this.logMetric('Page Load', this.metrics.pageLoad);
          this.logMetric('FCP', this.metrics.firstContentfulPaint);
          this.logMetric('TTI', this.metrics.timeToInteractive);
        }

        // Calculate Total Blocking Time
        const longTasks = performance.getEntriesByType('longtask') as any[];
        this.metrics.totalBlockingTime = longTasks.reduce((total, task) => {
          const blockingTime = task.duration - 50; // Tasks over 50ms are considered blocking
          return total + (blockingTime > 0 ? blockingTime : 0);
        }, 0);
        this.logMetric('TBT', this.metrics.totalBlockingTime);
      }, 0);
    });
  }

  private logMetric(name: string, value: number) {
    const roundedValue = Math.round(value * 100) / 100;
    console.log(`Performance Metric - ${name}: ${roundedValue}ms`);
    
    // Send to analytics if needed
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'web_vitals', {
        event_category: 'Performance',
        event_label: name,
        value: roundedValue,
        non_interaction: true,
      });
    }
  }

  // Measure component render time
  measureComponentRender(componentName: string, renderFn: () => void, props?: Record<string, any>) {
    const startTime = performance.now();
    renderFn();
    const endTime = performance.now();
    const renderTime = endTime - startTime;

    const metric: ComponentRenderMetrics = {
      componentName,
      renderTime,
      props,
    };

    if (!this.componentMetrics.has(componentName)) {
      this.componentMetrics.set(componentName, []);
    }
    this.componentMetrics.get(componentName)!.push(metric);

    if (renderTime > 16) { // Log slow renders (> 16ms)
      console.warn(`Slow component render: ${componentName} took ${renderTime.toFixed(2)}ms`, props);
    }
  }

  // Measure API call performance
  async measureAPICall<T>(url: string, fetchFn: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await fetchFn();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`API Call Performance - ${url}: ${duration.toFixed(2)}ms`);
      
      if (duration > 1000) { // Log slow API calls (> 1s)
        console.warn(`Slow API call: ${url} took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.error(`API Call Failed - ${url}: ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }

  // Get all collected metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Get component render statistics
  getComponentStats() {
    const stats: Record<string, { avgRenderTime: number; renderCount: number; slowRenders: number }> = {};
    
    this.componentMetrics.forEach((metrics, componentName) => {
      const renderTimes = metrics.map(m => m.renderTime);
      const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      const slowRenders = renderTimes.filter(t => t > 16).length;
      
      stats[componentName] = {
        avgRenderTime: Math.round(avgRenderTime * 100) / 100,
        renderCount: metrics.length,
        slowRenders,
      };
    });
    
    return stats;
  }

  // Clean up observers
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for measuring component performance
export function useComponentPerformance(componentName: string) {
  return {
    measureRender: (renderFn: () => void, props?: Record<string, any>) => {
      performanceMonitor.measureComponentRender(componentName, renderFn, props);
    },
  };
}

// HOC for automatic performance monitoring
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  const WrappedComponent = React.memo((props: P) => {
    const { measureRender } = useComponentPerformance(componentName);
    
    React.useEffect(() => {
      measureRender(() => {}, props);
    });
    
    return React.createElement(Component, props);
  });
  
  WrappedComponent.displayName = `withPerformanceMonitoring(${componentName})`;
  return WrappedComponent;
}