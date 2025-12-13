import type { NextAuthConfig } from 'next-auth';
import { z } from 'zod';
export type NextAuthOptions = NextAuthConfig;
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
export declare function buildCookieOptions(opts: CookieDomainOptions): NextAuthConfig["cookies"];
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
    portalUrl?: string;
    publicPortalUrl?: string;
    allowDefaults?: boolean;
}
/**
 * Provide sane defaults for local development so NextAuth stops warning about missing env vars.
 */
export declare function applyDevAuthDefaults(options?: DevAuthDefaultsOptions): void;
export declare function withSharedAuth(base: NextAuthConfig, optsOrDomain: SharedAuthOptions | string): NextAuthConfig;
/**
 * Helper to derive the likely session cookie names to probe in middleware.
 * Always include both secure (__Secure-) and non-secure variants because
 * different environments flip between dev/prod cookie prefixes.
 */
export declare function getCandidateSessionCookieNames(appId?: string): string[];
export interface PortalJwtPayload extends Record<string, unknown> {
    sub?: string;
    email?: string;
    name?: string;
    roles?: RolesClaim;
    apps?: string[];
    exp?: number;
}
export interface DecodePortalSessionOptions {
    cookieHeader?: string | null;
    cookieNames?: string[];
    appId?: string;
    secret?: string;
    debug?: boolean;
}
export declare function decodePortalSession(options?: DecodePortalSessionOptions): Promise<PortalJwtPayload | null>;
export type PortalUrlRequestLike = {
    headers: Headers;
    url: string;
};
export interface PortalUrlOptions {
    request?: PortalUrlRequestLike;
    fallbackOrigin?: string;
}
export interface PortalSessionProbeOptions {
    request: Request;
    appId?: string;
    cookieNames?: string[];
    secret?: string;
    portalUrl?: string;
    debug?: boolean;
    fetchImpl?: typeof fetch;
}
export declare function resolvePortalAuthOrigin(options?: PortalUrlOptions): string;
export declare function buildPortalUrl(path: string, options?: PortalUrlOptions): URL;
/**
 * Determine whether a request already carries a valid portal NextAuth session.
 * - Tries to decode the session cookie locally using the shared secret.
 * - Falls back to probing the portal `/api/auth/session` endpoint to handle
 *   environments where app-specific secrets differ from the portal.
 */
export declare function hasPortalSession(options: PortalSessionProbeOptions): Promise<boolean>;
export type AppEntitlement = {
    role: string;
    departments?: string[];
    depts?: string[];
};
export type RolesClaim = Record<string, AppEntitlement>;
export declare function getAppEntitlement(roles: unknown, appId: string): AppEntitlement | undefined;
