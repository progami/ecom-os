// Use the Prisma client generated for the central auth schema
// Explicitly reference the index.js to avoid ESM directory import issues in Node 20
// The generated client is produced by this package via `prisma generate --schema prisma/schema.prisma`
// and emitted to ../node_modules/.prisma/client-auth
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — path import to generated client
import { PrismaClient } from '../node_modules/.prisma/client-auth/index.js';
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
