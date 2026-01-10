import { PrismaClient } from '@targon/prisma-x-plan';

type GlobalWithPrisma = typeof globalThis & {
  __crossPlanPrisma?: PrismaClient;
};

function resolveDatasourceUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  try {
    const parsed = new URL(raw);
    if (!parsed.searchParams.has('schema')) {
      parsed.searchParams.set('schema', 'cross_plan');
      return parsed.toString();
    }
    return raw;
  } catch (error) {
    return raw;
  }
}

const globalForPrisma = globalThis as GlobalWithPrisma;

export const prisma =
  globalForPrisma.__crossPlanPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasourceUrl: resolveDatasourceUrl(),
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__crossPlanPrisma = prisma;
}

export default prisma;
