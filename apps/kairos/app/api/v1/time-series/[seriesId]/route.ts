import { NextResponse } from 'next/server';
import { Prisma } from '@targon/prisma-kairos';

import { withKairosAuth } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { buildKairosOwnershipWhere, getKairosActor } from '@/lib/access';

type Params = Promise<{ seriesId: string }>;

export const GET = withKairosAuth(async (request, session, { params }: { params: Params }) => {
  try {
    const actor = getKairosActor(session);
    const { seriesId } = await params;

    const series = await prisma.timeSeries.findFirst({
      where: {
        id: seriesId,
        ...buildKairosOwnershipWhere(actor),
      },
      include: {
        points: {
          orderBy: { t: 'asc' },
        },
        forecastsAsTarget: {
          select: {
            id: true,
            name: true,
            model: true,
            status: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!series) {
      return NextResponse.json({ error: 'Time series not found.' }, { status: 404 });
    }

    return NextResponse.json({
      series: {
        id: series.id,
        name: series.name,
        source: series.source,
        granularity: series.granularity,
        query: series.query,
        geo: series.geo,
        sourceMeta: series.sourceMeta,
        createdAt: series.createdAt.toISOString(),
        updatedAt: series.updatedAt.toISOString(),
        points: series.points.map((p) => ({
          t: p.t.toISOString(),
          value: p.value,
        })),
        forecasts: series.forecastsAsTarget,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const message =
        error.code === 'P2021'
          ? 'Kairos database tables are missing. Please run migrations.'
          : 'Database error. Please try again.';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const message = error instanceof Error ? error.message : 'Request failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
