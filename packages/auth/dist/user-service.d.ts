type AppEntitlementMap = Record<string, {
    role: string;
    departments: string[];
}>;
export type AuthenticatedUser = {
    id: string;
    email: string;
    username: string | null;
    fullName: string | null;
    roles: string[];
    entitlements: Record<string, {
        role: string;
        departments: string[];
    }>;
};
export declare function authenticateWithPortalDirectory(input: unknown): Promise<AuthenticatedUser | null>;
export declare function getUserEntitlements(userId: string): Promise<AppEntitlementMap>;
export declare function getUserByEmail(email: string): Promise<AuthenticatedUser | null>;
export {};
