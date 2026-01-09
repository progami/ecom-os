import { NextResponse } from 'next/server';

import { withChronosAuth } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { buildChronosOwnershipWhere, getChronosActor } from '@/lib/access';

export const GET = withChronosAuth(async (_request, session) => {
  const actor = getChronosActor(session);

  const series = await prisma.timeSeries.findMany({
    where: buildChronosOwnershipWhere(actor),
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
