import { PrismaClient } from '@prisma/client';

// Global PrismaClient instance to avoid creating multiple connections
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Transaction helper
export async function withTransaction<T>(
  callback: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(async (tx) => {
    return await callback(tx as PrismaClient);
  });
}

// Validation helpers
export const validators = {
  isValidDate: (date: any): boolean => {
    return date instanceof Date && !isNaN(date.getTime());
  },

  isPositiveNumber: (value: any): boolean => {
    return typeof value === 'number' && value > 0;
  },

  isNonNegativeNumber: (value: any): boolean => {
    return typeof value === 'number' && value >= 0;
  },

  isValidString: (value: any, minLength: number = 1): boolean => {
    return typeof value === 'string' && value.trim().length >= minLength;
  },

  isValidEnum: <T>(value: any, enumValues: T[]): boolean => {
    return enumValues.includes(value);
  }
};

// Database health check
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Audit log helper
// Note: auditLog model has been removed from schema
// This function is kept for reference but commented out
/*
export async function createAuditLog(params: {
  entityType: string;
  entityId: string;
  action: string;
  changes: any;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  if (process.env.ENABLE_AUDIT_LOG !== 'true') {
    return;
  }

  try {
    await prisma.auditLog.create({
      data: params
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging failure shouldn't break the main operation
  }
}
*/

// Period management helpers
// Note: financialPeriod model has been removed from schema
// This function is kept for reference but commented out
/*
export async function getCurrentFinancialPeriod(type: 'weekly' | 'monthly' | 'quarterly' | 'annual'): Promise<any> {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  switch (type) {
    case 'weekly':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'quarterly':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
      break;
    case 'annual':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
  }

  // Find or create the period
  return await prisma.financialPeriod.upsert({
    where: {
      type_startDate: {
        type,
        startDate
      }
    },
    update: {},
    create: {
      name: generatePeriodName(type, startDate),
      type,
      startDate,
      endDate,
      status: 'open'
    }
  });
}
*/

function generatePeriodName(type: string, startDate: Date): string {
  const year = startDate.getFullYear();
  const month = startDate.getMonth() + 1;
  const week = getWeekNumber(startDate);
  const quarter = Math.floor(startDate.getMonth() / 3) + 1;

  switch (type) {
    case 'weekly':
      return `${year}-W${week.toString().padStart(2, '0')}`;
    case 'monthly':
      return `${year}-${month.toString().padStart(2, '0')}`;
    case 'quarterly':
      return `${year}-Q${quarter}`;
    case 'annual':
      return year.toString();
    default:
      return `${year}-${type}`;
  }
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Batch operations
export async function batchCreate<T>(
  model: any,
  data: T[],
  batchSize: number = 100
): Promise<void> {
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    await model.createMany({
      data: batch,
      skipDuplicates: true
    });
  }
}

// System configuration helpers
// Note: SystemConfig table doesn't exist yet in schema
export async function getSystemConfig(key: string): Promise<any> {
  // SystemConfig table doesn't exist yet, return null
  /*
  const config = await prisma.systemConfig.findUnique({
    where: { key }
  });
  return config?.value;
  */
  return null;
}

export async function setSystemConfig(key: string, value: any, description?: string): Promise<void> {
  // SystemConfig table doesn't exist yet, no-op
  /*
  await prisma.systemConfig.upsert({
    where: { key },
    update: { value, description },
    create: { key, value, description }
  });
  */
}

// Export all database services for convenience
export { default as SharedFinancialDataService } from '../services/database/SharedFinancialDataService';
export { default as GLDataService } from '../services/database/GLDataService';
// InventoryBatchService removed - no longer using inventory tracking
// export { default as InventoryBatchService } from '../services/database/InventoryBatchService';
