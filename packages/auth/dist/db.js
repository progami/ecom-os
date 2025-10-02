import { PrismaClient } from '@prisma/client';
let prismaInstance = globalThis.__centralAuthPrisma ?? null;
export function getCentralAuthPrisma() {
    if (!process.env.CENTRAL_DB_URL) {
        throw new Error('CENTRAL_DB_URL is not configured');
    }
    if (!prismaInstance) {
        prismaInstance = new PrismaClient();
        if (process.env.NODE_ENV !== 'production') {
            ;
            globalThis.__centralAuthPrisma = prismaInstance;
        }
    }
    return prismaInstance;
}
