# Jason App - AI Assistant Context

This document provides context for AI assistants working on the Jason app.

## Project Overview

Jason is a productivity suite that aggregates tools for calendar management and email summarization. The app uses Next.js 14 with App Router, TypeScript, and Tailwind CSS.

## Key Features

1. **Calendar Aggregator** - Unifies calendars from Outlook, Trademan, Targon, and personal sources
2. **Email Summarizer** - AI-powered email summaries for long threads

## Architecture

- **Frontend**: Next.js 14 App Router, React, TypeScript, Tailwind CSS
- **Authentication**: JWT-based (planned)
- **Logging**: Winston-based structured logging with automatic sanitization
- **Security**: HTTPS with self-signed certificates for development

## Logging System

The app uses a comprehensive logging system based on Winston. Key features:

### Usage
```typescript
import logger from '@/lib/logger';

// Basic logging
logger.info('[ModuleName] Operation completed');
logger.error('[ModuleName] Failed', error);
logger.debug('[ModuleName] Details', { data });

// Context logging
const contextLogger = logger.child({ requestId: '123' });
contextLogger.info('[API] Processing request');
```

### Module Names
- `[Server]` - Server operations
- `[CalendarAPI]` - Calendar API endpoints
- `[EmailAPI]` - Email API endpoints
- `[CalendarSync]` - Calendar synchronization
- `[CLIENT]` - Client-side logs

### Security
The logger automatically redacts:
- Access tokens, refresh tokens
- Passwords, API keys
- OAuth tokens
- Cookie values

### Log Files
- Development: `logs/development.log` (cleared on restart)
- Production: 
  - `logs/error-YYYY-MM-DD.log` (30-day retention)
  - `logs/combined-YYYY-MM-DD.log` (7-day retention)

## Development Commands

```bash
# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# View logs
tail -f logs/development.log
```

## Project Structure

```
/app
  /api              # API routes
  /calendar-aggregator  # Calendar tool pages
  /email-summarizer    # Email tool pages
  page.tsx          # Home page with sidebar
/components
  /layout           # Layout components (sidebar, app-layout)
  /ui              # UI components (button, card, etc.)
/lib
  logger.ts        # Logging system
  log-sanitizer.ts # Log sanitization utilities
/docs
  logging.md       # Detailed logging documentation
/prisma
  schema.prisma    # Database schema (SQLite)
```

## UI/UX Guidelines

The app follows a modern, clean design inspired by professional SaaS applications:
- Dark theme with subtle borders
- Persistent sidebar navigation
- Card-based layouts
- Consistent spacing and typography
- Status indicators with colors (green/blue/orange/red)

## Security Considerations

1. All sensitive data must be sanitized in logs
2. Use HTTPS even in development
3. Implement proper authentication before production
4. Never log passwords, tokens, or API keys
5. Use environment variables for secrets

## Testing

When testing the app:
1. Check that logging works correctly
2. Verify sensitive data is redacted
3. Ensure all routes are accessible
4. Test error handling and logging
5. Verify UI responsiveness

## Common Issues

1. **HTTPS warnings**: Due to self-signed certificates in development
2. **Module not found**: Run `npm install` to install dependencies
3. **Logs not appearing**: Check log level and module names
4. **Build errors**: Ensure TypeScript types are correct

## Future Enhancements

1. Complete JWT authentication implementation
2. Add real calendar provider integrations (OAuth)
3. Implement email processing with AI
4. Add user preferences and settings
5. Implement data persistence with Prisma
6. Add comprehensive test coverage
7. Set up CI/CD pipeline
8. Add monitoring and alerting