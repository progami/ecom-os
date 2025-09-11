/**
 * Server-only Environment Configuration
 * Includes all environment variables including sensitive ones
 * This file should ONLY be imported in server-side code (API routes, server components)
 */


// Re-export client-safe configs
export * from './environment.client';

// Server-only configurations
export interface DatabaseConfig {
  url: string;
  shadowUrl?: string;
  directUrl?: string;
}

// Helper for server env vars
const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue!;
};

// Database configuration - SERVER ONLY
export const DATABASE_CONFIG: DatabaseConfig = {
  url: getEnvVar('DATABASE_URL'),
  shadowUrl: process.env.SHADOW_DATABASE_URL,
  directUrl: process.env.DIRECT_URL,
} as const;

// NextAuth configuration - SERVER ONLY
export const AUTH_CONFIG = {
  secret: process.env.NEXTAUTH_SECRET,
  url: process.env.NEXTAUTH_URL,
} as const;

// Security settings - SERVER ONLY
export const SECURITY_CONFIG = {
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000'),
  maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
  passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8'),
} as const;

// Rate limiting - SERVER ONLY
export const RATE_LIMIT_CONFIG = {
  apiRateLimit: parseInt(process.env.API_RATE_LIMIT || '100'),
  uploadRateLimit: parseInt(process.env.UPLOAD_RATE_LIMIT || '10'),
} as const;

// Validate required server environment variables
export const validateServerEnvironment = (): void => {
  const requiredVars = [
    'DATABASE_URL',
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};