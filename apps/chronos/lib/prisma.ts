import { PrismaClient } from '@ecom-os/prisma-chronos';

type GlobalWithPrisma = typeof globalThis & {
  __chronosPrisma?: PrismaClient;
};

function resolveDatasourceUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  try {
    const parsed = new URL(raw);
    if (!parsed.searchParams.has('schema')) {
      parsed.searchParams.set('schema', 'chronos');
      return parsed.toString();
    }
    return raw;
  } catch {
    return raw;
  }
}

const globalForPrisma = globalThis as GlobalWithPrisma;

export const prisma =
  globalForPrisma.__chronosPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasourceUrl: resolveDatasourceUrl(),
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__chronosPrisma = prisma;
}

export default prisma;

