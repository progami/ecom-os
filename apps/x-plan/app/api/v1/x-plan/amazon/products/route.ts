import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { withXPlanAuth } from '@/lib/api/auth';
import { requireXPlanStrategyAccess } from '@/lib/api/strategy-guard';
import { getWmsPrisma } from '@/lib/integrations/wms-client';

export const runtime = 'nodejs';

const querySchema = z.object({
  strategyId: z.string().min(1),
});

export const GET = withXPlanAuth(async (request: Request, session) => {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    strategyId: searchParams.get('strategyId'),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'strategyId is required' }, { status: 400 });
  }

  const { response } = await requireXPlanStrategyAccess(parsed.data.strategyId, session);
  if (response) return response;

  const strategyRow = await (prisma as unknown as Record<string, any>).strategy?.findUnique?.({
    where: { id: parsed.data.strategyId },
    select: { region: true },
  });
  const region = strategyRow?.region === 'UK' ? 'UK' : 'US';

  const wms = getWmsPrisma(region);
  if (!wms) {
    return NextResponse.json(
      {
        error:
          region === 'UK'
            ? 'WMS_DATABASE_URL_UK is not configured'
            : 'WMS_DATABASE_URL_US is not configured',
      },
      { status: 501 },
    );
  }

  const skus = await wms.sku.findMany({
    where: { isActive: true },
    select: {
      skuCode: true,
      asin: true,
      description: true,
    },
    orderBy: { skuCode: 'asc' },
  });

  return NextResponse.json({
    products: skus.map((sku) => ({
      sku: sku.skuCode,
      asin: sku.asin,
      name: sku.description,
    })),
  });
});

