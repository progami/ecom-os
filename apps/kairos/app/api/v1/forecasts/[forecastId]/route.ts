import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@targon/prisma-kairos';

import { withKairosAuth } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { buildKairosOwnershipWhere, getKairosActor } from '@/lib/access';

const paramsSchema = z.object({
  forecastId: z.string().min(1),
});

export const GET = withKairosAuth(async (_request, session, context: { params: Promise<unknown> }) => {
  try {
    const rawParams = await context.params;
    const safeParams =
      rawParams && typeof rawParams === 'object'
        ? { ...(rawParams as Record<string, unknown>), then: undefined }
        : rawParams;

    const { forecastId } = paramsSchema.parse(safeParams);
    const actor = getKairosActor(session);

    const forecast = await prisma.forecast.findFirst({
      where: {
        id: forecastId,
        ...buildKairosOwnershipWhere(actor),
      },
      include: {
        targetSeries: {
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
        regressors: {
          include: {
            series: {
              select: {
                id: true,
                name: true,
                source: true,
              },
            },
          },
        },
        runs: {
          orderBy: { ranAt: 'desc' },
          take: 20,
          select: {
            id: true,
            status: true,
            ranAt: true,
            errorMessage: true,
            params: true,
            output: true,
          },
        },
      },
    });

    if (!forecast) {
      return NextResponse.json({ error: 'Forecast not found' }, { status: 404 });
    }

    const points = await prisma.timeSeriesPoint.findMany({
      where: { seriesId: forecast.targetSeriesId },
      orderBy: { t: 'asc' },
      select: {
        t: true,
        value: true,
      },
    });

    const latestRun = forecast.runs[0] ?? null;
    const latestSuccessfulRun = forecast.runs.find((run) => run.status === 'SUCCESS') ?? null;

    return NextResponse.json({
      forecast: {
        id: forecast.id,
        name: forecast.name,
        model: forecast.model,
        horizon: forecast.horizon,
        config: forecast.config ?? null,
        status: forecast.status,
        lastRunAt: forecast.lastRunAt?.toISOString() ?? null,
        createdAt: forecast.createdAt.toISOString(),
        updatedAt: forecast.updatedAt.toISOString(),
        targetSeries: {
          ...forecast.targetSeries,
          createdAt: forecast.targetSeries.createdAt.toISOString(),
          updatedAt: forecast.targetSeries.updatedAt.toISOString(),
        },
        regressors: forecast.regressors.map((r) => ({
          id: r.id,
          seriesId: r.seriesId,
          futureMode: r.futureMode,
          series: r.series,
        })),
        points: points.map((p) => ({
          t: p.t.toISOString(),
          value: p.value,
        })),
        runs: forecast.runs.map((run) => ({
          id: run.id,
          status: run.status,
          ranAt: run.ranAt.toISOString(),
          errorMessage: run.errorMessage,
          params: run.params,
          output: run.output,
        })),
        latestRun: latestRun
          ? {
              id: latestRun.id,
              status: latestRun.status,
              ranAt: latestRun.ranAt.toISOString(),
              errorMessage: latestRun.errorMessage,
              params: latestRun.params,
              output: latestRun.output,
            }
          : null,
        latestSuccessfulRun: latestSuccessfulRun
          ? {
              id: latestSuccessfulRun.id,
              status: latestSuccessfulRun.status,
              ranAt: latestSuccessfulRun.ranAt.toISOString(),
              errorMessage: latestSuccessfulRun.errorMessage,
              params: latestSuccessfulRun.params,
              output: latestSuccessfulRun.output,
            }
          : null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.at(0)?.message ?? 'Invalid request.' },
        { status: 400 },
      );
    }

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

export const DELETE = withKairosAuth(async (_request, session, context: { params: Promise<unknown> }) => {
  try {
    const rawParams = await context.params;
    const safeParams =
      rawParams && typeof rawParams === 'object'
        ? { ...(rawParams as Record<string, unknown>), then: undefined }
        : rawParams;

    const { forecastId } = paramsSchema.parse(safeParams);
    const actor = getKairosActor(session);

    if (!actor.id && !actor.email) {
      return NextResponse.json({ error: 'User identity is missing.' }, { status: 403 });
    }

    const forecast = await prisma.forecast.findFirst({
      where: {
        id: forecastId,
        ...buildKairosOwnershipWhere(actor),
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!forecast) {
      return NextResponse.json({ error: 'Forecast not found' }, { status: 404 });
    }

    if (forecast.status === 'RUNNING') {
      return NextResponse.json({ error: 'Forecast is currently running.' }, { status: 409 });
    }

    await prisma.forecast.delete({ where: { id: forecast.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.at(0)?.message ?? 'Invalid request.' },
        { status: 400 },
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const message =
        error.code === 'P2021'
          ? 'Kairos database tables are missing. Please run migrations.'
          : 'Database error. Please try again.';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const message = error instanceof Error ? error.message : 'Delete failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
