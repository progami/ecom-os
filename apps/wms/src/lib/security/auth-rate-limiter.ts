import { NextRequest } from 'next/server';
import { authLogger, securityLogger } from '@/lib/logger';

interface AuthRateLimitConfig {
 windowMs: number;
 maxAttempts: number;
 lockoutDuration: number;
 lockoutThreshold: number;
 exponentialBackoff: boolean;
}

interface AuthAttemptEntry {
 count: number;
 firstAttemptTime: number;
 lastAttemptTime: number;
 lockoutUntil?: number;
 backoffMultiplier: number;
 shouldLockAccount?: boolean;
}

class AuthRateLimiter {
 private ipAttempts: Map<string, AuthAttemptEntry> = new Map();
 private userAttempts: Map<string, AuthAttemptEntry> = new Map();
 private cleanupInterval: NodeJS.Timeout;

 constructor() {
 // Clean up expired entries every 5 minutes
 this.cleanupInterval = setInterval(() => {
 const now = Date.now();
 
 // Clean IP attempts
 for (const [key, entry] of this.ipAttempts.entries()) {
 if (entry.lastAttemptTime + 24 * 60 * 60 * 1000 < now) { // Remove after 24 hours
 this.ipAttempts.delete(key);
 }
 }
 
 // Clean user attempts
 for (const [key, entry] of this.userAttempts.entries()) {
 if (entry.lastAttemptTime + 24 * 60 * 60 * 1000 < now) { // Remove after 24 hours
 this.userAttempts.delete(key);
 }
 }
 }, 5 * 60 * 1000);
 }

 async checkAuthLimit(
 req: NextRequest, 
 username: string | null,
 config: AuthRateLimitConfig
 ): Promise<{ 
 allowed: boolean; 
 retryAfter?: number;
 reason?: string;
 shouldLockAccount?: boolean;
 }> {
 const ip = this.getClientIp(req);
 const now = Date.now();
 
 // Check IP-based limits
 const ipResult = this.checkLimit(this.ipAttempts, ip, now, config);
 if (!ipResult.allowed) {
 securityLogger.warn('IP rate limit exceeded', {
 ip,
 attempts: ipResult.attempts,
 lockoutUntil: ipResult.lockoutUntil
 });
 return {
 allowed: false,
 retryAfter: ipResult.retryAfter,
 reason: 'ip_rate_limit'
 };
 }
 
 // Check username-based limits if username provided
 if (username) {
 const userResult = this.checkLimit(this.userAttempts, username.toLowerCase(), now, config);
 if (!userResult.allowed) {
 securityLogger.warn('User rate limit exceeded', {
 username,
 attempts: userResult.attempts,
 lockoutUntil: userResult.lockoutUntil
 });
 
 // Check if we should lock the account
 const shouldLockAccount = userResult.attempts >= config.lockoutThreshold;
 
 return {
 allowed: false,
 retryAfter: userResult.retryAfter,
 reason: 'user_rate_limit',
 shouldLockAccount
 };
 }
 }
 
 return { allowed: true };
 }

 recordFailedAttempt(
 req: NextRequest,
 username: string | null,
 config: AuthRateLimitConfig
 ): void {
 const ip = this.getClientIp(req);
 const now = Date.now();
 
 // Record IP attempt
 this.recordAttempt(this.ipAttempts, ip, now, config);
 
 // Record username attempt if provided
 if (username) {
 this.recordAttempt(this.userAttempts, username.toLowerCase(), now, config);
 }
 }

 recordSuccessfulLogin(
 req: NextRequest,
 username: string
 ): void {
 const ip = this.getClientIp(req);
 
 // Clear attempts for this IP and username
 this.ipAttempts.delete(ip);
 this.userAttempts.delete(username.toLowerCase());
 
 authLogger.info('Successful login - clearing rate limit counters', {
 ip,
 username
 });
 }

 // Note: Account locking is handled in the auth handler to avoid Prisma in middleware
 markAccountForLockout(username: string): void {
 const entry = this.userAttempts.get(username.toLowerCase());
 if (entry) {
 entry.shouldLockAccount = true;
 }
 }

 private checkLimit(
 store: Map<string, AuthAttemptEntry>,
 key: string,
 now: number,
 config: AuthRateLimitConfig
 ): { 
 allowed: boolean; 
 retryAfter?: number; 
 attempts: number;
 lockoutUntil?: number;
 } {
 const entry = store.get(key);
 
 if (!entry) {
 return { allowed: true, attempts: 0 };
 }
 
 // Check if currently locked out
 if (entry.lockoutUntil && entry.lockoutUntil > now) {
 const retryAfter = Math.ceil((entry.lockoutUntil - now) / 1000);
 return { 
 allowed: false, 
 retryAfter, 
 attempts: entry.count,
 lockoutUntil: entry.lockoutUntil
 };
 }
 
 // Check if window has expired
 if (entry.firstAttemptTime + config.windowMs < now) {
 // Reset the entry
 store.delete(key);
 return { allowed: true, attempts: 0 };
 }
 
 // Check if max attempts reached
 if (entry.count >= config.maxAttempts) {
 // Apply lockout
 const lockoutDuration = config.exponentialBackoff
 ? config.lockoutDuration * entry.backoffMultiplier
 : config.lockoutDuration;
 
 entry.lockoutUntil = now + lockoutDuration;
 entry.backoffMultiplier = Math.min(entry.backoffMultiplier * 2, 32); // Cap at 32x
 
 const retryAfter = Math.ceil(lockoutDuration / 1000);
 return { 
 allowed: false, 
 retryAfter, 
 attempts: entry.count,
 lockoutUntil: entry.lockoutUntil
 };
 }
 
 return { allowed: true, attempts: entry.count };
 }

 private recordAttempt(
 store: Map<string, AuthAttemptEntry>,
 key: string,
 now: number,
 config: AuthRateLimitConfig
 ): void {
 let entry = store.get(key);
 
 if (!entry || entry.firstAttemptTime + config.windowMs < now) {
 // Create new entry
 entry = {
 count: 1,
 firstAttemptTime: now,
 lastAttemptTime: now,
 backoffMultiplier: 1
 };
 } else {
 // Update existing entry
 entry.count++;
 entry.lastAttemptTime = now;
 }
 
 store.set(key, entry);
 }

 private getClientIp(req: NextRequest): string {
 const forwarded = req.headers.get('x-forwarded-for');
 const realIp = req.headers.get('x-real-ip');
 const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || 'unknown';
 return ip;
 }

 destroy(): void {
 if (this.cleanupInterval) {
 clearInterval(this.cleanupInterval);
 }
 }
}

// Singleton instance
let authRateLimiterInstance: AuthRateLimiter | null = null;

export function getAuthRateLimiter(): AuthRateLimiter {
 if (!authRateLimiterInstance) {
 authRateLimiterInstance = new AuthRateLimiter();
 }
 return authRateLimiterInstance;
}

// Auth rate limit configurations
export const authRateLimitConfig: AuthRateLimitConfig = {
 windowMs: 15 * 60 * 1000, // 15 minutes
 maxAttempts: 5, // 5 attempts before lockout
 lockoutDuration: 5 * 60 * 1000, // 5 minutes initial lockout
 lockoutThreshold: 10, // Lock account after 10 failed attempts
 exponentialBackoff: true // Double lockout duration for each subsequent lockout
};

// Helper function to check auth rate limits
export async function checkAuthRateLimit(
 req: NextRequest,
 username?: string
): Promise<Response | null> {
 const limiter = getAuthRateLimiter();
 const result = await limiter.checkAuthLimit(req, username || null, authRateLimitConfig);
 
 if (!result.allowed) {
 const message = result.reason === 'ip_rate_limit'
 ? 'Too many login attempts from this IP address'
 : 'Too many failed login attempts for this account';
 
 authLogger.warn('Auth rate limit exceeded', {
 reason: result.reason,
 retryAfter: result.retryAfter,
 shouldLockAccount: result.shouldLockAccount
 });
 
 // Mark account for lockout if threshold reached
 if (result.shouldLockAccount && username) {
 limiter.markAccountForLockout(username);
 }
 
 return new Response(
 JSON.stringify({
 error: 'Too many requests',
 message,
 retryAfter: result.retryAfter
 }),
 {
 status: 429,
 headers: {
 'Content-Type': 'application/json',
 'Retry-After': String(result.retryAfter || 60)
 }
 }
 );
 }
 
 return null;
}

// Export function to record failed attempts
export function recordFailedLoginAttempt(req: NextRequest, username?: string): void {
 const limiter = getAuthRateLimiter();
 limiter.recordFailedAttempt(req, username || null, authRateLimitConfig);
}

// Export function to record successful login
export function recordSuccessfulLogin(req: NextRequest, username: string): void {
 const limiter = getAuthRateLimiter();
 limiter.recordSuccessfulLogin(req, username);
}