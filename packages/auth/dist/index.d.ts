import type { NextAuthOptions } from 'next-auth';
import { z } from 'zod';
export type SameSite = 'lax' | 'strict' | 'none';
export interface CookieDomainOptions {
    domain: string;
    secure?: boolean;
    sameSite?: SameSite;
    appId?: string;
}
/**
 * Build consistent cookie names and options for NextAuth across apps.
 * - In production (secure), uses __Secure- prefix for session/callback and __Host- for csrf (no domain).
 * - In development, optionally prefixes cookie names with `${appId}.` to avoid collisions on localhost.
 */
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
export interface SharedAuthOptions {
    cookieDomain: string;
    appId?: string;
}
export interface DevAuthDefaultsOptions {
    appId?: string;
    port?: string | number;
    baseUrl?: string;
    cookieDomain?: string;
    centralUrl?: string;
    publicCentralUrl?: string;
}
/**
 * Provide sane defaults for local development so NextAuth stops warning about missing env vars.
 */
export declare function applyDevAuthDefaults(options?: DevAuthDefaultsOptions): void;
export declare function withSharedAuth(base: NextAuthOptions, optsOrDomain: SharedAuthOptions | string): NextAuthOptions;
/**
 * Helper to derive the likely session cookie names to probe in middleware.
 * In dev, returns both generic and app-prefixed variants for robustness.
 */
export declare function getCandidateSessionCookieNames(appId?: string): string[];
export type AppEntitlement = {
    role: string;
    depts?: string[];
};
export type RolesClaim = Record<string, AppEntitlement>;
export declare function getAppEntitlement(roles: unknown, appId: string): AppEntitlement | undefined;
