import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withKairosAuth } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { buildKairosOwnershipWhere, getKairosActor } from '@/lib/access';
import { runForecastNow } from '@/lib/forecasts/run';

const createSchema = z.object({
  name: z.string().trim().min(1),
  seriesId: z.string().min(1),
  model: z.enum(['PROPHET']).default('PROPHET'),
  horizon: z.coerce.number().int().min(1).max(3650),
  runNow: z.coerce.boolean().optional().default(true),
});

export const GET = withKairosAuth(async (_request, session) => {
  const actor = getKairosActor(session);

  const forecasts = await prisma.forecast.findMany({
    where: buildKairosOwnershipWhere(actor),
    orderBy: { updatedAt: 'desc' },
    include: {
      series: {
        select: {
          id: true,
          name: true,
          source: true,
          granularity: true,
          query: true,
          geo: true,
        },
      },
    },
  });

  return NextResponse.json({
    forecasts: forecasts.map((row) => ({
      id: row.id,
      name: row.name,
      model: row.model,
      horizon: row.horizon,
      status: row.status,
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      series: row.series,
    })),
  });
});

export const POST = withKairosAuth(async (request, session) => {
  const json = await request.json().catch(() => null);
  const payload = createSchema.parse(json);

  const actor = getKairosActor(session);

  const series = await prisma.timeSeries.findFirst({
    where: {
      id: payload.seriesId,
      ...buildKairosOwnershipWhere(actor),
    },
    select: {
      id: true,
      name: true,
      source: true,
      granularity: true,
      query: true,
      geo: true,
    },
  });

  if (!series) {
    return NextResponse.json({ error: 'Time series not found' }, { status: 404 });
  }

  const forecast = await prisma.forecast.create({
    data: {
      name: payload.name,
      model: payload.model,
      horizon: payload.horizon,
      status: 'DRAFT',
      seriesId: series.id,
      createdById: actor.id,
      createdByEmail: actor.email,
    },
    select: {
      id: true,
      name: true,
      model: true,
      horizon: true,
      status: true,
      lastRunAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!payload.runNow) {
    return NextResponse.json({
      forecast: {
        ...forecast,
        lastRunAt: forecast.lastRunAt?.toISOString() ?? null,
        createdAt: forecast.createdAt.toISOString(),
        updatedAt: forecast.updatedAt.toISOString(),
        series,
      },
    });
  }

  const run = await runForecastNow({ forecastId: forecast.id, session });
  if (!run) {
    return NextResponse.json({ error: 'Forecast not found' }, { status: 404 });
  }

  return NextResponse.json({
    forecast: {
      id: forecast.id,
      name: forecast.name,
      model: forecast.model,
      horizon: forecast.horizon,
      status: run.forecast.status,
      lastRunAt: run.forecast.lastRunAt,
      createdAt: forecast.createdAt.toISOString(),
      updatedAt: forecast.updatedAt.toISOString(),
      series,
    },
    run: run.run,
  });
});
