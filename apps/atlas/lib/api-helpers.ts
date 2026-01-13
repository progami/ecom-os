import { NextResponse } from 'next/server'
import { ZodError, ZodSchema } from 'zod'

// Rate limiting - simple in-memory implementation
// For production, use Redis-based solution
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

const RATE_LIMIT_WINDOW_MS = parsePositiveInt(process.env.ATLAS_RATE_LIMIT_WINDOW_MS, 60 * 1000) // 1 minute
// SECURITY FIX: Reduced default rate limit from 5000 to 500 requests/minute
// 500 req/min (8.3/sec) is still generous for normal usage but limits abuse potential
const RATE_LIMIT_MAX_REQUESTS = parsePositiveInt(process.env.ATLAS_RATE_LIMIT_MAX_REQUESTS, 500)
// Stricter rate limit for sensitive admin operations (100 requests/minute)
const STRICT_RATE_LIMIT_MAX_REQUESTS = parsePositiveInt(process.env.ATLAS_STRICT_RATE_LIMIT_MAX_REQUESTS, 100)

function stableHash(input: string): string {
  // Fast, non-crypto hash (djb2) – good enough for in-memory rate-limit keys.
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

export function getRateLimitKey(request: Request): string {
  const headers = request.headers

  const forwardedFor = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ipCandidate = (
    headers.get('cf-connecting-ip') ||
    headers.get('x-real-ip') ||
    headers.get('x-client-ip') ||
    forwardedFor
  )?.trim()

  // If IPs are missing/flattened by the proxy, fall back to a per-session identifier.
  const cookie = headers.get('cookie') ?? ''
  const userAgent = headers.get('user-agent') ?? ''
  const identitySource = cookie || userAgent || 'anonymous'
  const identityHash = stableHash(identitySource)

  const ipPart = ipCandidate ? `ip:${ipCandidate}` : 'ip:unknown'
  return `${ipPart}|id:${identityHash}`
}

export function checkRateLimit(key: string, maxRequests: number = RATE_LIMIT_MAX_REQUESTS): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, remaining: maxRequests - 1, resetIn: RATE_LIMIT_WINDOW_MS }
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now }
  }

  record.count++
  return { allowed: true, remaining: maxRequests - record.count, resetIn: record.resetTime - now }
}

export function rateLimitResponse(resetIn: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil(resetIn / 1000)),
        'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
        'X-RateLimit-Remaining': '0',
      },
    }
  )
}

// Clean up old rate limit entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key)
      }
    }
  }, 60 * 1000) // Clean up every minute
}

// Validation helper
export function validateBody<T>(schema: ZodSchema<T>, body: unknown): { success: true; data: T } | { success: false; error: NextResponse } {
  try {
    const data = schema.parse(body)
    return { success: true, data }
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }))
      return {
        success: false,
        error: NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 }),
      }
    }
    return {
      success: false,
      error: NextResponse.json({ error: 'Invalid request body' }, { status: 400 }),
    }
  }
}

// Safe error response - never expose internal details
export function safeErrorResponse(error: unknown, defaultMessage: string, status: number = 500): NextResponse {
  // Log the actual error server-side
  console.error(`[ATLAS API Error] ${defaultMessage}:`, error)

  // Check for known safe errors
  if (error instanceof Error) {
    // Prisma unique constraint violation
    if (error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'A record with this identifier already exists' }, { status: 409 })
    }
    // Prisma record not found
    if (error.message.includes('Record to update not found') || error.message.includes('Record to delete does not exist')) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }
  }

  // Return generic error message to client
  return NextResponse.json({ error: defaultMessage }, { status })
}

// Apply rate limiting to a request
export function withRateLimit(request: Request): NextResponse | null {
  const key = getRateLimitKey(request)
  const { allowed, resetIn } = checkRateLimit(key)

  if (!allowed) {
    return rateLimitResponse(resetIn)
  }

  return null // Continue processing
}

// Apply stricter rate limiting for sensitive admin operations
export function withStrictRateLimit(request: Request): NextResponse | null {
  // Use a separate key prefix for strict rate limiting to track admin operations separately
  const baseKey = getRateLimitKey(request)
  const key = `strict:${baseKey}`
  const { allowed, resetIn } = checkRateLimit(key, STRICT_RATE_LIMIT_MAX_REQUESTS)

  if (!allowed) {
    return rateLimitResponse(resetIn)
  }

  return null // Continue processing
}
