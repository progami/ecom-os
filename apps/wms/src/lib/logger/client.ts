/* eslint-disable no-console */
// Minimal client-side logger that falls back to console output in development

const shouldLog = typeof process !== 'undefined' && process.env.NODE_ENV === 'development'

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

const normalizeMetadata = (metadata?: unknown): Record<string, unknown> | undefined => {
  if (metadata === undefined || metadata === null) {
    return undefined
  }

  if (typeof metadata === 'object') {
    return metadata as Record<string, unknown>
  }

  return { value: metadata }
}

const log = (
  level: LogLevel,
  category: string,
  message: string,
  metadata?: unknown
) => {
  if (!shouldLog || typeof window === 'undefined') {
    return
  }

  const method = console[level] ?? console.log
  const normalized = normalizeMetadata(metadata)

  if (normalized) {
    method(`[${category}] ${message}`, normalized)
  } else {
    method(`[${category}] ${message}`)
  }
}

export const clientLogger = {
  info: (message: string, metadata?: unknown) => log('info', 'client', message, metadata),
  warn: (message: string, metadata?: unknown) => log('warn', 'client', message, metadata),
  error: (message: string, metadata?: unknown) => log('error', 'client', message, metadata),
  debug: (message: string, metadata?: unknown) => log('debug', 'client', message, metadata),
  action: (action: string, metadata?: unknown) => log('info', 'action', action, metadata),
  navigation: (from: string, to: string, metadata?: unknown) =>
    log('info', 'navigation', `Navigation from ${from} to ${to}`, {
      from,
      to,
      ...(normalizeMetadata(metadata) ?? {}),
    }),
  performance: (metric: string, value: number, metadata?: unknown) =>
    log('info', 'performance', `${metric}: ${value}ms`, {
      metric,
      value,
      ...(normalizeMetadata(metadata) ?? {}),
    }),
  api: (method: string, endpoint: string, status: number, duration: number, metadata?: unknown) =>
    log(status >= 400 ? 'error' : 'info', 'api', `${method} ${endpoint} - ${status}`, {
      method,
      endpoint,
      status,
      duration,
      ...(normalizeMetadata(metadata) ?? {}),
    }),
}

export function measurePerformance(name: string, fn: () => void | Promise<void>) {
  if (typeof performance === 'undefined') {
    return fn()
  }

  const start = performance.now()
  const result = fn()

  if (result instanceof Promise) {
    return result.finally(() => {
      const duration = performance.now() - start
      clientLogger.performance(name, duration)
    })
  }

  const duration = performance.now() - start
  clientLogger.performance(name, duration)
  return result
}

export function logErrorToService(error: Error, errorInfo: unknown) {
  log('error', 'error-boundary', error.message, {
    name: error.name,
    stack: error.stack,
    errorInfo,
  })
}
