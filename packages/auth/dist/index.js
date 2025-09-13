import { z } from 'zod';
export function buildCookieOptions(opts) {
    const secure = opts.secure ?? (process.env.NODE_ENV === 'production');
    const sameSite = opts.sameSite ?? 'lax';
    return {
        sessionToken: {
            name: secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
            options: {
                httpOnly: true,
                sameSite,
                path: '/',
                secure,
                domain: opts.domain,
            },
        },
        callbackUrl: {
            name: secure ? '__Secure-next-auth.callback-url' : 'next-auth.callback-url',
            options: {
                sameSite,
                path: '/',
                secure,
                domain: opts.domain,
            },
        },
        csrfToken: {
            name: secure ? '__Host-next-auth.csrf-token' : 'next-auth.csrf-token',
            options: {
                httpOnly: true,
                sameSite,
                path: '/',
                secure,
                // For __Host- cookies, domain must not be set; here we keep domain set unless you choose __Host naming strictly.
                domain: opts.domain,
            },
        },
    };
}
export const AuthEnvSchema = z.object({
    NEXTAUTH_SECRET: z.string().min(16),
    NEXTAUTH_URL: z.string().url().optional(),
    COOKIE_DOMAIN: z.string().min(1), // e.g. .targonglobal.com
});
export function withSharedAuth(base, cookieDomain) {
    return {
        // Keep base providers/callbacks etc. from app
        ...base,
        session: {
            strategy: 'jwt',
            maxAge: 30 * 24 * 60 * 60,
            ...base.session,
        },
        debug: process.env.NODE_ENV === 'development' || base.debug,
        secret: process.env.NEXTAUTH_SECRET ?? base.secret,
        cookies: {
            ...buildCookieOptions({ domain: cookieDomain, sameSite: 'lax' }),
            ...base.cookies,
        },
    };
}
