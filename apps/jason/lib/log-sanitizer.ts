/**
 * Log sanitizer to remove sensitive data from logs
 */

// Patterns to identify sensitive data
const SENSITIVE_PATTERNS = [
  // OAuth tokens
  { pattern: /access_token['":\s]+['"]?([^'"\s,}]+)/gi, replacement: 'access_token": "[REDACTED]"' },
  { pattern: /refresh_token['":\s]+['"]?([^'"\s,}]+)/gi, replacement: 'refresh_token": "[REDACTED]"' },
  { pattern: /bearer\s+([^\s,}]+)/gi, replacement: 'Bearer [REDACTED]' },
  
  // API keys and secrets
  { pattern: /client_secret['":\s]+['"]?([^'"\s,}]+)/gi, replacement: 'client_secret": "[REDACTED]"' },
  { pattern: /api_key['":\s]+['"]?([^'"\s,}]+)/gi, replacement: 'api_key": "[REDACTED]"' },
  { pattern: /password['":\s]+['"]?([^'"\s,}]+)/gi, replacement: 'password": "[REDACTED]"' },
  
  // JWT tokens
  { pattern: /jwt['":\s]+['"]?([^'"\s,}]+)/gi, replacement: 'jwt": "[REDACTED]"' },
  { pattern: /token['":\s]+['"]?([^'"\s,}]+)/gi, replacement: 'token": "[REDACTED]"' },
  
  // Calendar OAuth
  { pattern: /outlook_token['":\s]+['"]?([^'"\s,}]+)/gi, replacement: 'outlook_token": "[REDACTED]"' },
  { pattern: /google_token['":\s]+['"]?([^'"\s,}]+)/gi, replacement: 'google_token": "[REDACTED]"' },
  
  // URLs with potential secrets
  { pattern: /code=([^&\s]+)/gi, replacement: 'code=[REDACTED]' },
  { pattern: /state=([^&\s]+)/gi, replacement: 'state=[REDACTED]' },
  
  // Cookie values
  { pattern: /cookie:\s*([^\s;,}]+)/gi, replacement: 'cookie: [REDACTED]' },
  { pattern: /set-cookie:\s*([^\s;,}]+)/gi, replacement: 'set-cookie: [REDACTED]' },
];

// Fields to completely remove from objects
const SENSITIVE_FIELDS = [
  'access_token',
  'refresh_token',
  'client_secret',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'clientSecret',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'set-cookie',
  'jwt',
  'outlook_token',
  'google_token',
  'outlook_secret',
  'google_secret'
];

/**
 * Sanitize a string by removing sensitive data
 */
export function sanitizeString(str: string): string {
  let sanitized = str;
  
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  
  return sanitized;
}

/**
 * Deep sanitize an object by removing sensitive fields
 */
export function sanitizeObject(obj: unknown, visited = new WeakSet<object>()): unknown {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  // Handle circular references
  if (visited.has(obj)) {
    return '[Circular Reference]';
  }
  visited.add(obj);
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, visited));
  }
  
  const sanitized: Record<string, unknown> = {};

  try {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Check if this is a sensitive field
      if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        // Sanitize string values
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeObject(value, visited);
      } else {
        sanitized[key] = value;
      }
    }
  } catch {
    // If Object.entries fails (e.g., on certain native objects), return a safe representation
    return '[Complex Object]';
  }
  
  return sanitized;
}

// Export for use in production
export function shouldLog(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_PRODUCTION_LOGS === 'true';
}