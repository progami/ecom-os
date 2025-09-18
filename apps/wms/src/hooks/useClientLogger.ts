'use client'

import { useEffect, useCallback } from 'react'
import { clientLogger } from '@/lib/logger/client'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'

const toMetadata = (metadata?: unknown): Record<string, unknown> => {
  if (metadata === undefined || metadata === null) {
    return {}
  }

  if (typeof metadata === 'object') {
    return { ...(metadata as Record<string, unknown>) }
  }

  return { value: metadata }
}

export function useClientLogger() {
  const pathname = usePathname()
  const { data: session } = useSession()

  // Log page views
  useEffect(() => {
    if (clientLogger) {
      clientLogger.navigation('page_view', pathname, {
        userId: session?.user?.id,
        userRole: session?.user?.role,
        timestamp: new Date().toISOString()
      })
    }
  }, [pathname, session])

  // Log user actions
  const logAction = useCallback((action: string, metadata?: unknown) => {
    if (clientLogger) {
      clientLogger.action(action, {
        ...toMetadata(metadata),
        userId: session?.user?.id,
        userRole: session?.user?.role,
        page: pathname,
        timestamp: new Date().toISOString()
      })
    }
  }, [pathname, session])

  // Log performance metrics
  const logPerformance = useCallback((metric: string, value: number, metadata?: unknown) => {
    if (clientLogger) {
      clientLogger.performance(metric, value, {
        ...toMetadata(metadata),
        userId: session?.user?.id,
        page: pathname
      })
    }
  }, [pathname, session])

  // Log errors
  const logError = useCallback((message: string, error: unknown) => {
    if (clientLogger) {
      clientLogger.error(message, {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        userId: session?.user?.id,
        page: pathname
      })
    }
  }, [pathname, session])

  return {
    logAction,
    logPerformance,
    logError
  }
}
