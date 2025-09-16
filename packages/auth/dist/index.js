import { z } from 'zod';
/**
 * Build consistent cookie names and options for NextAuth across apps.
 * - In production (secure), uses __Secure- prefix for session/callback and __Host- for csrf (no domain).
 * - In development, optionally prefixes cookie names with `${appId}.` to avoid collisions on localhost.
 */
export function buildCookieOptions(opts) {
    const secure = opts.secure ?? (process.env.NODE_ENV === 'production');
    const sameSite = opts.sameSite ?? 'lax';
    const appPrefix = !secure && opts.appId ? `${opts.appId}.` : '';
    const sessionTokenName = secure
        ? '__Secure-next-auth.session-token'
        : `${appPrefix}next-auth.session-token`;
    const callbackUrlName = secure
        ? '__Secure-next-auth.callback-url'
        : `${appPrefix}next-auth.callback-url`;
    const csrfTokenName = secure
        ? '__Host-next-auth.csrf-token'
        : `${appPrefix}next-auth.csrf-token`;
    // Determine if we should set the Domain attribute on cookies.
    // On localhost / 127.0.0.1, setting Domain causes cookies to be rejected by browsers.
    const rawDomain = (opts.domain || '').trim().toLowerCase();
    const isIPv4 = /^\d+\.\d+\.\d+\.\d+$/.test(rawDomain);
    const isLocalhost = rawDomain === 'localhost' || rawDomain.endsWith('.localhost');
    const shouldSetDomain = !!rawDomain && !isIPv4 && !isLocalhost;
    const domainOption = shouldSetDomain ? { domain: rawDomain } : {};
    return {
        sessionToken: {
            name: sessionTokenName,
            options: {
                httpOnly: true,
                sameSite,
                path: '/',
                secure,
                // Only set Domain when valid (never on localhost/IP). Host-only cookies work in dev.
                ...domainOption,
            },
        },
        callbackUrl: {
            name: callbackUrlName,
            options: {
                sameSite,
                path: '/',
                secure,
                ...domainOption,
            },
        },
        csrfToken: {
            name: csrfTokenName,
            options: {
                httpOnly: true,
                sameSite,
                path: '/',
                secure,
                // Important: __Host- cookies cannot set domain in secure mode.
                // In dev, also avoid Domain on localhost/IP to ensure cookie is accepted.
                ...(secure ? {} : domainOption),
            },
        },
    };
}
export const AuthEnvSchema = z.object({
    NEXTAUTH_SECRET: z.string().min(16),
    NEXTAUTH_URL: z.string().url().optional(),
    COOKIE_DOMAIN: z.string().min(1), // e.g. .targonglobal.com
});
/**
 * Compose app-specific NextAuth options with shared, secure defaults.
 */
export function withSharedAuth(base, optsOrDomain) {
    const opts = typeof optsOrDomain === 'string'
        ? { cookieDomain: optsOrDomain }
        : optsOrDomain;
    return {
        // Keep base providers/callbacks etc. from app
        ...base,
        session: {
            strategy: 'jwt',
            maxAge: 30 * 24 * 60 * 60,
            ...base.session,
        },
        debug: process.env.NODE_ENV === 'development' || !!base.debug,
        secret: process.env.NEXTAUTH_SECRET ?? base.secret,
        cookies: {
            ...buildCookieOptions({ domain: opts.cookieDomain, sameSite: 'lax', appId: opts.appId }),
            ...base.cookies,
        },
    };
}
/**
 * Helper to derive the likely session cookie names to probe in middleware.
 * In dev, returns both generic and app-prefixed variants for robustness.
 */
export function getCandidateSessionCookieNames(appId) {
    const isProd = process.env.NODE_ENV === 'production';
    const names = [];
    if (isProd) {
        names.push('__Secure-next-auth.session-token');
    }
    else {
        names.push('next-auth.session-token');
        if (appId)
            names.push(`${appId}.next-auth.session-token`);
    }
    return names;
}
export function getAppEntitlement(roles, appId) {
    if (!roles || typeof roles !== 'object')
        return undefined;
    const rec = roles;
    const ent = rec[appId];
    if (!ent || typeof ent !== 'object')
        return undefined;
    return {
        role: String(ent.role ?? ''),
        depts: Array.isArray(ent.depts) ? ent.depts.map(String) : undefined,
    };
}
