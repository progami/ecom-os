import 'server-only';

import { PrismaClient as WmsPrismaClient } from '@ecom-os/prisma-wms';
import type { StrategyRegion } from '@/lib/strategy-region';

type WmsRegion = Extract<StrategyRegion, 'US' | 'UK'>;

type GlobalWithWmsPrisma = typeof globalThis & {
  __xplanWmsPrismaByRegion?: Partial<Record<WmsRegion, WmsPrismaClient>>;
};

function wmsDatabaseUrlForRegion(region: WmsRegion): string | null {
  const key = region === 'UK' ? 'WMS_DATABASE_URL_UK' : 'WMS_DATABASE_URL_US';
  const url = process.env[key]?.trim();
  return url && url.length > 0 ? url : null;
}

export function getWmsPrisma(region: WmsRegion): WmsPrismaClient | null {
  const url = wmsDatabaseUrlForRegion(region);
  if (!url) return null;

  const globalForPrisma = globalThis as GlobalWithWmsPrisma;
  if (!globalForPrisma.__xplanWmsPrismaByRegion) {
    globalForPrisma.__xplanWmsPrismaByRegion = {};
  }

  const cached = globalForPrisma.__xplanWmsPrismaByRegion[region];
  if (cached) return cached;

  const client = new WmsPrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: { db: { url } },
  });

  globalForPrisma.__xplanWmsPrismaByRegion[region] = client;
  return client;
}

