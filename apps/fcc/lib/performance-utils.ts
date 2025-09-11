import { structuredLogger } from './client-safe-logger';

export function measurePageLoad(pageName: string) {
  if (typeof window !== 'undefined' && window.performance) {
    const timing = window.performance.timing;
    
    // Check if the page has finished loading
    if (timing.loadEventEnd === 0) {
      // Page hasn't finished loading yet, wait for it
      window.addEventListener('load', () => {
        const loadTime = timing.loadEventEnd - timing.navigationStart;
        const perfData = {
          page: pageName,
          loadTime,
          timing: {
            navigationStart: timing.navigationStart,
            loadEventEnd: timing.loadEventEnd,
            domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
            responseEnd: timing.responseEnd
          }
        };
        structuredLogger.info(`[Performance] ${pageName} page loaded in ${loadTime}ms`, perfData);
      }, { once: true });
      return 0;
    }
    
    // Calculate load time only if loadEventEnd is available
    const loadTime = timing.loadEventEnd - timing.navigationStart;
    
    // Validate the result to ensure it's not negative
    if (loadTime < 0) {
      const errorData = {
        page: pageName,
        loadTime,
        timing: {
          navigationStart: timing.navigationStart,
          loadEventEnd: timing.loadEventEnd,
          issue: 'Negative load time calculated'
        }
      };
      structuredLogger.warn(`[Performance] Invalid load time calculated for ${pageName}: ${loadTime}ms. Timing values - loadEventEnd: ${timing.loadEventEnd}, navigationStart: ${timing.navigationStart}`, errorData);
      return 0;
    }
    
    const perfData = {
      page: pageName,
      loadTime,
      timing: {
        navigationStart: timing.navigationStart,
        loadEventEnd: timing.loadEventEnd,
        domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
        responseEnd: timing.responseEnd
      }
    };
    structuredLogger.info(`[Performance] ${pageName} page loaded in ${loadTime}ms`, perfData);
    return loadTime;
  }
  return 0;
}

export function measurePageLoadWhenReady(pageName: string) {
  if (typeof window !== 'undefined' && window.performance) {
    // Use requestIdleCallback to ensure measurement happens when browser is idle
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        measurePageLoad(pageName);
      }, { timeout: 2000 });
    } else {
      // Fallback for browsers that don't support requestIdleCallback
      setTimeout(() => {
        measurePageLoad(pageName);
      }, 100);
    }
  }
}

export function measureApiCall(endpoint: string, duration: number) {
  structuredLogger.info(`[Performance] API call to ${endpoint} took ${duration}ms`);
  return duration;
}

export function measureComponentRender(componentName: string, duration: number) {
  if (duration > 100) {
    structuredLogger.warn(`[Performance] ${componentName} render took ${duration}ms (slow)`);
  } else {
    structuredLogger.debug(`[Performance] ${componentName} render took ${duration}ms`);
  }
  return duration;
}

export function prefetchSubModuleData(moduleName: string) {
  structuredLogger.debug(`[Performance] Prefetching data for ${moduleName} module`);
  // This is a placeholder for prefetching logic
  // In a real implementation, you might prefetch API data or preload components
  return Promise.resolve();
}