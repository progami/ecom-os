# Jason App Logging Guide

This document outlines the logging implementation and best practices for the Jason application.

## Overview

The Jason app uses a structured logging system based on Winston, following industry best practices for security, performance, and maintainability.

## Key Features

- **Structured Logging**: Consistent format across all environments
- **Automatic Sanitization**: Sensitive data is automatically redacted
- **Module Identification**: Each log entry identifies its source module
- **Environment-Specific**: Different configurations for development and production
- **Performance Optimized**: Minimal overhead with async logging

## Log Levels

The application uses the following log levels:

- **ERROR** (0): Critical errors requiring immediate attention
- **WARN** (1): Warning conditions that should be investigated
- **INFO** (2): Informational messages about normal operations
- **HTTP** (3): HTTP request/response logging
- **DEBUG** (4): Detailed debugging information

## Usage Examples

### Basic Logging

```typescript
import logger from '@/lib/logger';

// Simple logging
logger.info('[ModuleName] Operation completed successfully');
logger.error('[ModuleName] Failed to process request', error);
logger.warn('[ModuleName] Using deprecated API');
logger.debug('[ModuleName] Processing item', { id: 123, status: 'pending' });
```

### API Route Logging

```typescript
import logger from '@/lib/logger';

export async function POST(request: Request) {
  logger.info('[CalendarAPI] Sync request received');
  
  try {
    const data = await request.json();
    logger.debug('[CalendarAPI] Processing sync for user', { userId: data.userId });
    
    // Process request...
    
    logger.info('[CalendarAPI] Sync completed successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[CalendarAPI] Sync failed', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
```

### Client-Side Logging

```typescript
// In client components
console.log('[CLIENT] [ComponentName] User action performed');
console.error('[CLIENT] [ComponentName] Failed to load data', error);
```

### Context Logging

```typescript
import { Logger } from '@/lib/logger';

// Create a logger with context
const contextLogger = new Logger({ requestId: '123', userId: 'abc' });
contextLogger.info('[UserService] Processing request');
contextLogger.error('[UserService] Operation failed', error);
```

## Module Naming Convention

Always prefix your log messages with the module name in square brackets:

- `[Server]` - Server startup and general server operations
- `[CalendarAPI]` - Calendar aggregator API endpoints
- `[EmailAPI]` - Email summarizer API endpoints
- `[AuthService]` - Authentication service
- `[CalendarSync]` - Calendar synchronization service
- `[EmailProcessor]` - Email processing service
- `[CLIENT]` - Client-side logs

## Security

The logger automatically sanitizes sensitive data patterns including:

- Access tokens and refresh tokens
- API keys and client secrets
- Passwords and JWT tokens
- OAuth tokens (Outlook, Google)
- Cookie values
- Authorization headers

### Example of Sanitization

```typescript
// Input
logger.info('[Auth] Token received', { 
  access_token: 'abc123...', 
  user: 'john@example.com' 
});

// Output in logs
[2024-01-15 10:30:45] [Auth] [INFO] - Token received {"access_token":"[REDACTED]","user":"john@example.com"}
```

## Development Environment

In development:
- Logs appear in the console with color coding
- All logs are written to `logs/development.log`
- Log file is cleared on server restart
- Full debug logging is enabled

### Console Output Format
```
[2024-01-15 10:30:45] [CalendarSync] [INFO] - Sync completed successfully
[2024-01-15 10:30:46] [EmailAPI] [ERROR] - Failed to process email
[2024-01-15 10:30:47] [HTTP] ✅ POST /api/calendar/sync → 200 (123ms)
```

## Production Environment

In production:
- File-based logging with rotation
- Separate files for errors and combined logs
- JSON format for easy parsing
- Exception and rejection handlers

### Log Files
- `logs/error-YYYY-MM-DD.log` - Error logs (30-day retention)
- `logs/combined-YYYY-MM-DD.log` - All logs (7-day retention)
- `logs/exceptions.log` - Unhandled exceptions
- `logs/rejections.log` - Unhandled promise rejections

## Best Practices

1. **Be Descriptive but Concise**
   ```typescript
   // Good
   logger.info('[CalendarSync] Synced 15 events for user 123');
   
   // Bad
   logger.info('Sync done');
   ```

2. **Include Relevant Context**
   ```typescript
   logger.error('[EmailProcessor] Failed to parse email', error, {
     emailId: email.id,
     subject: email.subject,
     retryCount: 3
   });
   ```

3. **Use Appropriate Log Levels**
   - ERROR: System failures, unhandled exceptions
   - WARN: Deprecations, retries, fallbacks
   - INFO: Business operations, state changes
   - DEBUG: Detailed flow, variable values

4. **Avoid Logging in Loops**
   ```typescript
   // Bad
   items.forEach(item => {
     logger.debug('[Processor] Processing item', item);
   });
   
   // Good
   logger.debug('[Processor] Processing batch', { count: items.length });
   ```

5. **Log Performance Metrics**
   ```typescript
   const start = Date.now();
   // ... operation ...
   const duration = Date.now() - start;
   logger.info('[CalendarSync] Sync completed', { duration, eventCount: 50 });
   ```

## Viewing Logs

### Development
```bash
# View console output
npm run dev

# Tail log file
tail -f logs/development.log

# Search logs
grep "ERROR" logs/development.log
grep "CalendarSync" logs/development.log
```

### Production
```bash
# View today's errors
cat logs/error-$(date +%Y-%m-%d).log

# Search combined logs
grep "user:123" logs/combined-*.log
```

## Troubleshooting

### Common Issues

1. **Logs not appearing**
   - Check log level: `process.env.LOG_LEVEL`
   - Verify logger is imported correctly
   - Ensure module name is included in message

2. **Sensitive data in logs**
   - Add pattern to `SENSITIVE_PATTERNS` in `lib/log-sanitizer.ts`
   - Add field name to `SENSITIVE_FIELDS`
   - Test sanitization with sample data

3. **Performance impact**
   - Use appropriate log levels
   - Avoid logging large objects
   - Consider sampling for high-frequency operations

## Integration with Monitoring

The structured JSON format in production makes it easy to integrate with monitoring services:

- **ELK Stack**: Parse JSON logs directly
- **Datadog**: Use log pipelines for parsing
- **CloudWatch**: Stream logs to AWS
- **Sentry**: Integrate error tracking

Example log entry for parsing:
```json
{
  "timestamp": "2024-01-15 10:30:45",
  "level": "error",
  "message": "[EmailProcessor] Failed to parse email",
  "error": "Invalid format",
  "metadata": {
    "emailId": "123",
    "retryCount": 3
  }
}
```

## Future Enhancements

- Request correlation IDs across services
- Distributed tracing support
- Real-time log streaming
- Advanced filtering and search
- Performance metrics dashboard