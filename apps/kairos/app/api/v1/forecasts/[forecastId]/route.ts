import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withKairosAuth } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { buildKairosOwnershipWhere, getKairosActor } from '@/lib/access';

const paramsSchema = z.object({
  forecastId: z.string().min(1),
});

export const GET = withKairosAuth(async (_request, session, context: { params: unknown }) => {
  const { forecastId } = paramsSchema.parse(context.params);
  const actor = getKairosActor(session);

  const forecast = await prisma.forecast.findFirst({
    where: {
      id: forecastId,
      ...buildKairosOwnershipWhere(actor),
    },
    include: {
      series: {
        select: {
          id: true,
          name: true,
          source: true,
          granularity: true,
          query: true,
          geo: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      runs: {
        orderBy: { ranAt: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          ranAt: true,
          errorMessage: true,
          output: true,
        },
      },
    },
  });

  if (!forecast) {
    return NextResponse.json({ error: 'Forecast not found' }, { status: 404 });
  }

  const points = await prisma.timeSeriesPoint.findMany({
    where: { seriesId: forecast.seriesId },
    orderBy: { t: 'asc' },
    select: {
      t: true,
      value: true,
    },
  });

  const latestRun = forecast.runs[0] ?? null;

  return NextResponse.json({
    forecast: {
      id: forecast.id,
      name: forecast.name,
      model: forecast.model,
      horizon: forecast.horizon,
      status: forecast.status,
      lastRunAt: forecast.lastRunAt?.toISOString() ?? null,
      createdAt: forecast.createdAt.toISOString(),
      updatedAt: forecast.updatedAt.toISOString(),
      series: {
        ...forecast.series,
        createdAt: forecast.series.createdAt.toISOString(),
        updatedAt: forecast.series.updatedAt.toISOString(),
      },
      points: points.map((p) => ({
        t: p.t.toISOString(),
        value: p.value,
      })),
      latestRun: latestRun
        ? {
            id: latestRun.id,
            status: latestRun.status,
            ranAt: latestRun.ranAt.toISOString(),
            errorMessage: latestRun.errorMessage,
            output: latestRun.output,
          }
        : null,
    },
  });
});
