import logger from '@/utils/logger';

/**
 * Environment Configuration
 * 
 * This file has been split into client and server versions:
 * - Use './environment.client' for client-side code
 * - Use './environment.server' for server-side code (API routes, server components)
 * 
 * Direct imports from this file are deprecated.
 */

// For backward compatibility, export client-safe configs
// But show a warning in development
if (process.env.NODE_ENV === 'development') {
  logger.warn(
    'Warning: Importing from @/config/environment is deprecated.\n' +
    'Use @/config/environment.client for client-side code or\n' +
    '@/config/environment.server for server-side code.'
  );
}

export * from './environment.client';