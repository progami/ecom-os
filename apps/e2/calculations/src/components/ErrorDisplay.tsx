import React from 'react'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface ErrorDisplayProps {
  errors: {
    reconciliation?: Error | null
    revenue?: Error | null
    expenses?: Error | null
  }
  onRetry?: () => void
}

export function ErrorDisplay({ errors, onRetry }: ErrorDisplayProps) {
  const errorEntries = Object.entries(errors).filter(([_, error]) => error !== null && error !== undefined)
  
  if (errorEntries.length === 0) return null
  
  return (
    <div className="space-y-4">
      {errorEntries.map(([key, error]) => (
        <Alert key={key} variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading {key} data</AlertTitle>
          <AlertDescription>
            <p className="mb-2">{error?.message || 'An unexpected error occurred'}</p>
            {onRetry && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onRetry}
                className="mt-2"
              >
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  )
}