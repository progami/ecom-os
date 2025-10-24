import { PrismaClient } from '../node_modules/.prisma/client-auth/index.js';
export declare function getPortalAuthPrisma(): PrismaClient;
declare global {
    var __portalAuthPrisma: PrismaClient | null | undefined;
}
