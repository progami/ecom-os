import { randomBytes } from 'crypto'
import { NextRequest } from 'next/server'

// CSRF token storage (in production, use Redis or database)
const csrfTokenStore = new Map<string, { token: string; expires: number }>()

// Generate CSRF token
export function generateCSRFToken(sessionId: string): string {
 const token = randomBytes(32).toString('hex')
 const expires = Date.now() + 24 * 60 * 60 * 1000 // 24 hours
 
 csrfTokenStore.set(sessionId, { token, expires })
 
 // Clean up expired tokens
 if (csrfTokenStore.size > 1000) {
 const now = Date.now()
 for (const [id, data] of csrfTokenStore.entries()) {
 if (data.expires < now) {
 csrfTokenStore.delete(id)
 }
 }
 }
 
 return token
}

// Validate CSRF token
export function validateCSRFToken(sessionId: string, token: string): boolean {
 const stored = csrfTokenStore.get(sessionId)
 
 if (!stored) {
 return false
 }
 
 if (stored.expires < Date.now()) {
 csrfTokenStore.delete(sessionId)
 return false
 }
 
 return stored.token === token
}

// Get CSRF token from request
export function getCSRFToken(request: NextRequest): string | null {
 // Check header first (for AJAX requests)
 const headerToken = request.headers.get('x-csrf-token')
 if (headerToken) {
 return headerToken
 }
 
 // Check body for form submissions
 // Note: This would need to be parsed from the body in actual implementation
 // For now, we'll rely on header-based CSRF tokens
 
 return null
}

// Middleware helper to check CSRF
export function isCSRFSafeMethod(method: string): boolean {
 // Safe methods don't need CSRF protection
 return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
}