import type { RequestInternal } from 'next-auth';

interface RateLimitContext {
  ip?: string;
  identifier?: string;
}

interface AttemptTracker {
  count: number;
  firstAttempt: number;
  lockoutUntil?: number;
}

interface AuthRateLimitConfig {
  windowMs: number;
  maxAttempts: number;
  lockoutMs: number;
}

const DEFAULT_CONFIG: AuthRateLimitConfig = {
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxAttempts: 5,
  lockoutMs: 15 * 60 * 1000, // 15 minutes
};

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const RETRY_AFTER_FALLBACK_SECONDS = 60;

export class AuthRateLimitError extends Error {
  retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = 'AuthRateLimitError';
    this.retryAfter = retryAfter;
  }
}

class AuthRateLimiter {
  private readonly byIp = new Map<string, AttemptTracker>();
  private readonly byIdentifier = new Map<string, AttemptTracker>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor(private readonly config: AuthRateLimitConfig) {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  assertAllowed(context: RateLimitContext) {
    const now = Date.now();
    const { ip, identifier } = context;

    const retryAfterIp = ip ? this.getRetryAfter(this.byIp, ip, now) : undefined;
    if (retryAfterIp !== undefined) {
      throw new AuthRateLimitError('Too many sign-in attempts. Please try again later.', retryAfterIp);
    }

    const retryAfterIdentifier = identifier
      ? this.getRetryAfter(this.byIdentifier, identifier, now)
      : undefined;
    if (retryAfterIdentifier !== undefined) {
      throw new AuthRateLimitError('Too many sign-in attempts. Please try again later.', retryAfterIdentifier);
    }
  }

  recordFailure(context: RateLimitContext) {
    const now = Date.now();
    const { ip, identifier } = context;
    if (ip) {
      this.bumpAttempts(this.byIp, ip, now);
    }
    if (identifier) {
      this.bumpAttempts(this.byIdentifier, identifier, now);
    }
  }

  recordSuccess(context: RateLimitContext) {
    const { ip, identifier } = context;
    if (ip) {
      this.byIp.delete(ip);
    }
    if (identifier) {
      this.byIdentifier.delete(identifier);
    }
  }

  private getRetryAfter(store: Map<string, AttemptTracker>, key: string, now: number): number | undefined {
    const entry = store.get(key);
    if (!entry) return undefined;

    if (entry.lockoutUntil && entry.lockoutUntil > now) {
      return Math.max(1, Math.ceil((entry.lockoutUntil - now) / 1000));
    }

    if (entry.firstAttempt + this.config.windowMs < now) {
      store.delete(key);
      return undefined;
    }

    return undefined;
  }

  private bumpAttempts(store: Map<string, AttemptTracker>, key: string, now: number) {
    const entry = store.get(key);
    if (!entry || entry.firstAttempt + this.config.windowMs < now) {
      store.set(key, {
        count: 1,
        firstAttempt: now,
        lockoutUntil: undefined,
      });
      return;
    }

    entry.count += 1;

    if (entry.count >= this.config.maxAttempts) {
      entry.lockoutUntil = now + this.config.lockoutMs;
    }
  }

  private cleanup() {
    const now = Date.now();
    const expiry = this.config.windowMs + this.config.lockoutMs;
    this.pruneMap(this.byIp, now, expiry);
    this.pruneMap(this.byIdentifier, now, expiry);
  }

  private pruneMap(store: Map<string, AttemptTracker>, now: number, expiryMs: number) {
    for (const [key, entry] of store.entries()) {
      const lockoutExpired = entry.lockoutUntil ? entry.lockoutUntil + expiryMs < now : true;
      const attemptsExpired = entry.firstAttempt + expiryMs < now;
      if (lockoutExpired && attemptsExpired) {
        store.delete(key);
      }
    }
  }
}

let globalLimiter: AuthRateLimiter | undefined;

function getLimiter(): AuthRateLimiter {
  if (!globalLimiter) {
    globalLimiter = new AuthRateLimiter(DEFAULT_CONFIG);
  }
  return globalLimiter;
}

export function getAuthRateLimiter() {
  return getLimiter();
}

export function resolveRateLimitContext(req: RequestInternal | undefined, identifier?: string): RateLimitContext {
  const headers = req?.headers;
  const headerLookup = (name: string): string | undefined => {
    if (!headers) return undefined;
    if (typeof (headers as Headers).get === 'function') {
      return (headers as Headers).get(name) ?? undefined;
    }
    const key = name.toLowerCase();
    const value = (headers as Record<string, string | string[] | undefined>)[key] ??
      (headers as Record<string, string | string[] | undefined>)[name];
    if (Array.isArray(value)) return value[0];
    return value;
  };

  const forwarded = headerLookup('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim()
    || headerLookup('x-real-ip')?.trim()
    || (req as any)?.ip
    || undefined;

  const normalizedIdentifier = identifier?.toLowerCase().trim() || undefined;

  return { ip, identifier: normalizedIdentifier };
}

export function formatRetryAfterSeconds(error: AuthRateLimitError): number {
  if (typeof error.retryAfter === 'number' && Number.isFinite(error.retryAfter)) {
    return error.retryAfter;
  }
  return RETRY_AFTER_FALLBACK_SECONDS;
}
