'use client'

import type { ReactNode } from 'react'
import { Alert } from '@/components/ui/alert'

type RecordAlertsProps = {
  error: string | null
  errorDetails?: string[] | null
  errorFooter?: ReactNode
  success: string | null
  onDismissError?: () => void
  onDismissSuccess?: () => void
  className?: string
}

export function RecordAlerts({
  error,
  errorDetails,
  errorFooter,
  success,
  onDismissError,
  onDismissSuccess,
  className,
}: RecordAlertsProps) {
  if (!error && !success) return null

  return (
    <div className={className ? `space-y-3 ${className}` : 'space-y-3'}>
      {error ? (
        <Alert
          variant="error"
          title={errorDetails?.length ? error : undefined}
          onDismiss={onDismissError}
        >
          {errorDetails?.length ? (
            <div className="space-y-3">
              <ul className="list-disc pl-5 space-y-1">
                {errorDetails.map((detail, idx) => (
                  <li key={`${idx}:${detail}`}>{detail}</li>
                ))}
              </ul>
              {errorFooter ? <div>{errorFooter}</div> : null}
            </div>
          ) : (
            error
          )}
        </Alert>
      ) : null}

      {success ? (
        <Alert variant="success" onDismiss={onDismissSuccess}>
          {success}
        </Alert>
      ) : null}
    </div>
  )
}
