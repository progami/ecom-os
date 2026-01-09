import { NextResponse } from 'next/server';

import { withKairosAuth } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { buildKairosOwnershipWhere, getKairosActor } from '@/lib/access';

export const GET = withKairosAuth(async (_request, session) => {
  const actor = getKairosActor(session);

  const series = await prisma.timeSeries.findMany({
    where: buildKairosOwnershipWhere(actor),
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      source: true,
      granularity: true,
      query: true,
      geo: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { points: true } },
    },
  });

  return NextResponse.json({
    series: series.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      pointsCount: row._count.points,
    })),
  });
});
