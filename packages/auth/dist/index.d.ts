import type { NextAuthOptions } from 'next-auth';
import { z } from 'zod';
export type SameSite = 'lax' | 'strict' | 'none';
export interface CookieDomainOptions {
    domain: string;
    secure?: boolean;
    sameSite?: SameSite;
}
export declare function buildCookieOptions(opts: CookieDomainOptions): NextAuthOptions["cookies"];
export declare const AuthEnvSchema: z.ZodObject<{
    NEXTAUTH_SECRET: z.ZodString;
    NEXTAUTH_URL: z.ZodOptional<z.ZodString>;
    COOKIE_DOMAIN: z.ZodString;
}, "strip", z.ZodTypeAny, {
    NEXTAUTH_SECRET: string;
    COOKIE_DOMAIN: string;
    NEXTAUTH_URL?: string | undefined;
}, {
    NEXTAUTH_SECRET: string;
    COOKIE_DOMAIN: string;
    NEXTAUTH_URL?: string | undefined;
}>;
export declare function withSharedAuth(base: NextAuthOptions, cookieDomain: string): NextAuthOptions;
