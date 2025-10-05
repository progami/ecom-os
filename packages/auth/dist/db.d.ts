import { PrismaClient } from '../node_modules/.prisma/client-auth';
export declare function getCentralAuthPrisma(): PrismaClient;
declare global {
    var __centralAuthPrisma: PrismaClient | null | undefined;
}
