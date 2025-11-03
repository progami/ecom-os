/* eslint-disable no-console */

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
 const method = console[level] ?? console.log
 const normalized = normalizeMetadata(metadata)
 if (normalized) {
 method(`[${category}] ${message}`, normalized)
 } else {
 method(`[${category}] ${message}`)
 }
}

const createLogger = (category: string) => ({
 info: (message: string, metadata?: unknown) => log('info', category, message, metadata),
 warn: (message: string, metadata?: unknown) => log('warn', category, message, metadata),
 error: (message: string, metadata?: unknown) => log('error', category, message, metadata),
 debug: (message: string, metadata?: unknown) => log('debug', category, message, metadata),
})

export const systemLogger = createLogger('system')
export const authLogger = createLogger('auth')
export const apiLogger = createLogger('api')
export const dbLogger = createLogger('database')
export const businessLogger = createLogger('business')
export const securityLogger = createLogger('security')
export const cacheLogger = createLogger('cache')
export const serverLogger = createLogger('server')

export const perfLogger = {
 log: (message: string, metadata?: unknown) => log('info', 'performance', message, metadata),
 slow: (operation: string, duration: number, threshold: number, metadata?: unknown) => {
 if (duration > threshold) {
 log('warn', 'performance', `Slow operation detected: ${operation} (${duration}ms)`, {
 threshold,
 duration,
 operation,
 ...(normalizeMetadata(metadata) ?? {}),
 })
 }
 },
}
