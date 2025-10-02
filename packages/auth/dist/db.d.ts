import { PrismaClient } from '@prisma/client';
export declare function getCentralAuthPrisma(): PrismaClient;
declare global {
    var __centralAuthPrisma: PrismaClient | null | undefined;
}
