'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<unknown>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true, 
      error, 
      errorInfo: null 
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Update state with error info
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to development log file in development mode
    if (process.env.NODE_ENV === 'development') {
      this.logErrorToDevelopmentLog(error, errorInfo);
    }

    // Auto-reset after 30 seconds
    this.resetTimeoutId = window.setTimeout(() => {
      this.resetErrorBoundary();
    }, 30000);
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error boundary when resetKeys change
    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetKeys?.some((key, index) => key !== prevProps.resetKeys?.[index])) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
    
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  };

  private logErrorToDevelopmentLog = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        component: 'ErrorBoundary',
        message: 'Runtime error caught by error boundary',
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        errorInfo: {
          componentStack: errorInfo.componentStack,
        },
        url: window.location.href,
        userAgent: navigator.userAgent,
      };

      // Send to logging endpoint
      await fetch('/api/v1/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: [logEntry]
        }),
      }).catch(() => {
        // Silently fail if logging endpoint is not available
        console.warn('Failed to send error to logging endpoint');
      });
    } catch (logError) {
      console.warn('Failed to log error:', logError);
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-gray-900 rounded-lg border border-gray-700">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-4">Something went wrong</h2>
          <p className="text-gray-300 text-center mb-6 max-w-md">
            An unexpected error occurred. The error has been logged and our team has been notified.
          </p>
          
          <div className="flex gap-4 mb-6">
            <button
              onClick={this.resetErrorBoundary}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              Reload Page
            </button>
          </div>

          {/* Error details in development */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-6 w-full max-w-4xl">
              <summary className="cursor-pointer text-yellow-400 font-medium mb-2">
                🐛 Error Details (Development Only)
              </summary>
              <div className="bg-gray-800 p-4 rounded border text-sm font-mono text-gray-300 overflow-auto max-h-64">
                <div className="text-red-400 font-bold mb-2">Error:</div>
                <div className="mb-4">{this.state.error.message}</div>
                
                {this.state.error.stack && (
                  <>
                    <div className="text-red-400 font-bold mb-2">Stack Trace:</div>
                    <pre className="whitespace-pre-wrap text-xs mb-4">
                      {this.state.error.stack}
                    </pre>
                  </>
                )}
                
                {this.state.errorInfo?.componentStack && (
                  <>
                    <div className="text-red-400 font-bold mb-2">Component Stack:</div>
                    <pre className="whitespace-pre-wrap text-xs">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: ErrorInfo) => {
    console.error('Manual error handling:', error, errorInfo);
    
    // Log to development log file in development mode
    if (process.env.NODE_ENV === 'development') {
      fetch('/api/v1/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: [{
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            component: 'useErrorHandler',
            message: 'Manual error reported',
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
            url: window.location.href,
            userAgent: navigator.userAgent,
          }]
        }),
      }).catch(() => {
        console.warn('Failed to send error to logging endpoint');
      });
    }
  };
};

// Specific error boundary for reports
export const ReportErrorBoundary = ({ children }: { children: ReactNode }) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-[300px] flex flex-col items-center justify-center p-6 bg-gray-900 rounded-lg border border-gray-700">
          <div className="text-yellow-400 text-4xl mb-3">📊</div>
          <h3 className="text-xl font-semibold text-white mb-2">Report Error</h3>
          <p className="text-gray-300 text-center mb-4">
            This report encountered an error. Please try refreshing or importing new data.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Refresh Report
          </button>
        </div>
      }
      onError={(error, errorInfo) => {
        console.error('Report Error:', error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;