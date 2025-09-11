// Client-side logger that sends logs to server
class ClientLogger {
  private logBuffer: any[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private originalConsole: any = {};
  private enabled: boolean = false;
  
  constructor() {
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    // Always enable in development - check multiple conditions
    this.enabled = process.env.NODE_ENV === 'development' || 
                   process.env.NODE_ENV !== 'production' ||
                   window.location.hostname === 'localhost' ||
                   window.location.hostname === '127.0.0.1';
    
    // Get the pre-existing log buffer from the early init script
    if ((window as any).__logBuffer && Array.isArray((window as any).__logBuffer)) {
      this.logBuffer = (window as any).__logBuffer;
      console.log('[ClientLogger] Found', this.logBuffer.length, 'pre-existing logs from early init');
    }
    
    // Store original console methods FIRST
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
      debug: console.debug.bind(console)
    };
    
    // Debug log to see what's happening
    this.originalConsole.log('[ClientLogger] Initialized:', this.enabled ? 'ENABLED' : 'DISABLED');
    
    if (!this.enabled) return;
    
    // Start flush interval
    this.startFlushInterval();
    
    // Intercept console methods (they're already intercepted by init-logger.js, but we take over here)
    this.interceptConsole();
    
    // Immediately flush any pre-existing logs
    if (this.logBuffer.length > 0) {
      setTimeout(() => this.flush(), 100); // Small delay to ensure everything is ready
    }
  }
  
  private interceptConsole() {
    this.originalConsole.log('[ClientLogger] Intercepting console methods...');
    
    // Get stack trace to find caller info
    const getCallerInfo = () => {
      const stack = new Error().stack || '';
      const lines = stack.split('\n');
      // Find the first line that's not from client-logger.ts
      for (let i = 3; i < lines.length; i++) {
        const line = lines[i];
        if (!line.includes('client-logger') && !line.includes('console.') && line.includes('.js') || line.includes('.tsx') || line.includes('.ts')) {
          // Extract filename and line number
          const match = line.match(/([^\/\s]+\.(tsx?|jsx?|js)):(\d+):(\d+)/);
          if (match) {
            return `${match[1]}:${match[3]}`;
          }
        }
      }
      return '';
    };
    
    // Override console.log
    console.log = (...args: any[]) => {
      const caller = getCallerInfo();
      if (caller) {
        // Prepend caller info to match browser console format
        this.addToBuffer('log', [caller, ...args]);
      } else {
        this.addToBuffer('log', args);
      }
      this.originalConsole.log(...args);
    };
    
    // Override console.error
    console.error = (...args: any[]) => {
      const caller = getCallerInfo();
      if (caller) {
        this.addToBuffer('error', [caller, ...args]);
      } else {
        this.addToBuffer('error', args);
      }
      this.originalConsole.error(...args);
    };
    
    // Override console.warn
    console.warn = (...args: any[]) => {
      const caller = getCallerInfo();
      if (caller) {
        this.addToBuffer('warn', [caller, ...args]);
      } else {
        this.addToBuffer('warn', args);
      }
      this.originalConsole.warn(...args);
    };
    
    // Override console.info
    console.info = (...args: any[]) => {
      const caller = getCallerInfo();
      if (caller) {
        this.addToBuffer('info', [caller, ...args]);
      } else {
        this.addToBuffer('info', args);
      }
      this.originalConsole.info(...args);
    };
    
    // Override console.debug
    console.debug = (...args: any[]) => {
      const caller = getCallerInfo();
      if (caller) {
        this.addToBuffer('debug', [caller, ...args]);
      } else {
        this.addToBuffer('debug', args);
      }
      this.originalConsole.debug(...args);
    };
  }
  
  private addToBuffer(level: string, args: any[]) {
    // Don't process our own logs to prevent loops
    if (args.length > 0 && typeof args[0] === 'string' && args[0].startsWith('[ClientLogger]')) {
      return;
    }
    
    // Convert args to string message - EXACTLY as they appear in console
    const message = args.map(arg => {
      if (arg instanceof Error) {
        return arg.stack || arg.toString();
      } else if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    // Add to buffer
    this.logBuffer.push({
      level,
      message,
      timestamp: new Date().toISOString()
    });
    
    // Debug
    if (this.logBuffer.length === 1 || this.logBuffer.length % 5 === 0) {
      this.originalConsole.log('[ClientLogger] Buffer size:', this.logBuffer.length);
    }
    
    // Flush if buffer is getting large
    if (this.logBuffer.length >= 10) {
      this.flush();
    }
  }
  
  private startFlushInterval() {
    // Flush logs every 2 seconds
    this.flushInterval = setInterval(() => {
      if (this.logBuffer.length > 0) {
        this.flush();
      }
    }, 2000);
  }
  
  private failureCount = 0;
  private maxFailures = 5;
  
  private async flush() {
    if (!this.enabled || this.logBuffer.length === 0) return;
    
    // Stop trying if we've failed too many times
    if (this.failureCount >= this.maxFailures) {
      if (this.logBuffer.length > 100) {
        // Keep only the most recent 100 logs to prevent memory issues
        this.logBuffer = this.logBuffer.slice(-100);
      }
      return;
    }
    
    // Copy current buffer and clear it
    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];
    
    // Debug: Log the flush attempt
    this.originalConsole.log('[ClientLogger] Flushing', logsToSend.length, 'logs to server');
    
    try {
      const response = await fetch('/api/v1/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: logsToSend }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Reset failure count on success
      this.failureCount = 0;
      this.originalConsole.log('[ClientLogger] Successfully sent logs');
    } catch (error) {
      // Increment failure count
      this.failureCount++;
      
      // Only restore logs if we haven't hit the failure limit
      if (this.failureCount < this.maxFailures) {
        // Restore logs to buffer if send failed
        this.logBuffer = [...logsToSend, ...this.logBuffer];
        this.originalConsole.error('[ClientLogger] Failed to send logs to server:', error, `(attempt ${this.failureCount}/${this.maxFailures})`);
      } else {
        this.originalConsole.error('[ClientLogger] Max failures reached, discarding logs to prevent memory issues');
      }
    }
  }
  
  // Clean up on page unload
  destroy() {
    if (!this.enabled) return;
    
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    // Flush any remaining logs
    this.flush();
  }
}

// Initialize client logger
let clientLogger: ClientLogger | null = null;

export function initializeClientLogger() {
  if (typeof window !== 'undefined' && !clientLogger) {
    clientLogger = new ClientLogger();
    
    // Flush logs on page unload
    window.addEventListener('beforeunload', () => {
      if (clientLogger) {
        clientLogger.destroy();
      }
    });
    
    // Also capture unhandled errors
    window.addEventListener('error', (event) => {
      console.error('Unhandled error:', event.error || event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });
    
    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason, {
        promise: event.promise
      });
    });
    
    // Capture navigation events
    window.addEventListener('popstate', (event) => {
      console.log('[Navigation] Browser back/forward button pressed', {
        state: event.state
      });
    });
    
    // Capture all click events (for debugging user interactions)
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const tagName = target.tagName;
      const className = target.className;
      const id = target.id;
      const text = target.textContent?.trim().substring(0, 50); // First 50 chars
      
      // Only log button/link clicks to avoid noise
      if (tagName === 'BUTTON' || tagName === 'A' || target.closest('button') || target.closest('a')) {
        console.log('[User Click]', {
          element: tagName,
          id: id || undefined,
          class: className || undefined,
          text: text || undefined,
          href: (target as HTMLAnchorElement).href || undefined
        });
      }
    }, true);
    
    // Capture form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      console.log('[Form Submit]', {
        formId: form.id || undefined,
        formName: form.name || undefined,
        action: form.action,
        method: form.method
      });
    }, true);
    
    // Capture network errors from fetch
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const [url, options] = args;
      const method = options?.method || 'GET';
      const urlString = url.toString();
      
      // Skip logging for common API endpoints to reduce noise
      const skipPatterns = [
        '/api/health',  // Skip health check logs as they're expected to fail during startup
        '/api/v1/xero/reports/',
        '/api/v1/bookkeeping/',
        '/api/v1/analytics/',
        '/api/v1/auth/session',
        '/api/v1/database/status',
        '/api/v1/xero/status',
        '/api/v1/logs',
        '/_next/',
        '.js',
        '.css',
        '.json',
        '/api/v1/xero/sync/progress/'
      ];
      
      const shouldSkipLogging = skipPatterns.some(pattern => urlString.includes(pattern));
      
      // Only log non-routine requests or errors
      if (!shouldSkipLogging && (method !== 'GET' || urlString.includes('/api/v1/xero/sync'))) {
        console.log('[Network Request]', {
          url: urlString,
          method: method
        });
      }
      
      try {
        const response = await originalFetch(...args);
        
        if (!response.ok && !shouldSkipLogging) {
          console.error('[Network Error]', {
            url: urlString,
            method: method,
            status: response.status,
            statusText: response.statusText
          });
        }
        
        return response;
      } catch (error) {
        // Don't log errors for endpoints we're skipping
        if (!shouldSkipLogging) {
          console.error('[Network Failed]', {
            url: urlString,
            method: method,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
        throw error;
      }
    };
    
    // Log page visibility changes
    document.addEventListener('visibilitychange', () => {
      console.log('[Page Visibility]', {
        hidden: document.hidden,
        visibilityState: document.visibilityState
      });
    });
    
    // Log performance metrics
    if ('PerformanceObserver' in window) {
      try {
        // Observe long tasks
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) { // Tasks longer than 50ms
              console.warn('[Performance] Long task detected', {
                duration: Math.round(entry.duration),
                startTime: Math.round(entry.startTime),
                name: entry.name
              });
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        // Some browsers don't support longtask
      }
    }
    
    console.log('[ClientLogger] Enhanced logging initialized - capturing ALL events');
  }
}

export { clientLogger };