'use client'

import React, { Component, ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // Store error info in state
    this.setState({
      error,
      errorInfo
    })
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        return <>{this.props.fallback}</>
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-2xl w-full">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                    Something went wrong
                  </h2>
                  
                  <div className="text-sm text-red-800 dark:text-red-200 space-y-2">
                    <p>An error occurred while rendering this component.</p>
                    
                    {this.state.error && (
                      <div className="mt-4">
                        <p className="font-medium mb-1">Error:</p>
                        <pre className="bg-red-100 dark:bg-red-900/40 p-3 rounded text-xs overflow-auto">
                          {this.state.error.toString()}
                        </pre>
                      </div>
                    )}
                    
                    {this.state.errorInfo && (
                      <details className="mt-4">
                        <summary className="cursor-pointer font-medium text-red-700 dark:text-red-300 hover:underline">
                          Component Stack Trace
                        </summary>
                        <pre className="mt-2 bg-red-100 dark:bg-red-900/40 p-3 rounded text-xs overflow-auto max-h-64">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                  
                  <div className="mt-6 flex gap-3">
                    <Button 
                      onClick={this.handleReset}
                      variant="outline"
                      size="sm"
                      className="text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40"
                    >
                      Try Again
                    </Button>
                    
                    <Button
                      onClick={() => window.location.reload()}
                      variant="outline"
                      size="sm"
                      className="text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40"
                    >
                      Refresh Page
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}