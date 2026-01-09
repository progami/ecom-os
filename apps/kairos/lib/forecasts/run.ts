import 'server-only';

import prisma from '@/lib/prisma';
import { buildKairosOwnershipWhere, getKairosActor } from '@/lib/access';
import { runProphetForecast } from '@/lib/models/prophet';

type RunResult = {
  forecast: {
    id: string;
    status: string;
    lastRunAt: string | null;
  };
  run: {
    id: string;
    status: string;
    ranAt: string;
    output: unknown;
    errorMessage: string | null;
  };
};

export async function runForecastNow(args: { forecastId: string; session: any }): Promise<RunResult | null> {
  const actor = getKairosActor(args.session);

  const forecast = await prisma.forecast.findFirst({
    where: {
      id: args.forecastId,
      ...buildKairosOwnershipWhere(actor),
    },
    include: {
      series: true,
    },
  });

  if (!forecast) {
    return null;
  }

  const points = await prisma.timeSeriesPoint.findMany({
    where: { seriesId: forecast.seriesId },
    orderBy: { t: 'asc' },
  });

  const ds = points.map((point) => Math.floor(point.t.getTime() / 1000));
  const y = points.map((point) => point.value);

  const now = new Date();

  await prisma.forecast.update({
    where: { id: forecast.id },
    data: {
      status: 'RUNNING',
    },
  });

  try {
    if (forecast.model !== 'PROPHET') {
      throw new Error(`Unsupported model: ${forecast.model}`);
    }

    const result = await runProphetForecast({
      ds,
      y,
      horizon: forecast.horizon,
    });

    const output = {
      model: forecast.model,
      series: {
        id: forecast.series.id,
        source: forecast.series.source,
        query: forecast.series.query,
        geo: forecast.series.geo,
        granularity: forecast.series.granularity,
      },
      generatedAt: now.toISOString(),
      points: result.points,
      meta: result.meta,
    };

    const run = await prisma.forecastRun.create({
      data: {
        forecastId: forecast.id,
        status: 'SUCCESS',
        ranAt: now,
        params: {
          horizon: forecast.horizon,
        },
        output,
      },
      select: {
        id: true,
        status: true,
        ranAt: true,
        output: true,
        errorMessage: true,
      },
    });

    const updated = await prisma.forecast.update({
      where: { id: forecast.id },
      data: {
        status: 'READY',
        lastRunAt: now,
      },
      select: {
        id: true,
        status: true,
        lastRunAt: true,
      },
    });

    return {
      forecast: {
        id: updated.id,
        status: updated.status,
        lastRunAt: updated.lastRunAt?.toISOString() ?? null,
      },
      run: {
        id: run.id,
        status: run.status,
        ranAt: run.ranAt.toISOString(),
        output: run.output,
        errorMessage: run.errorMessage,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    const run = await prisma.forecastRun.create({
      data: {
        forecastId: forecast.id,
        status: 'FAILED',
        ranAt: now,
        errorMessage: message,
        params: {
          horizon: forecast.horizon,
        },
      },
      select: {
        id: true,
        status: true,
        ranAt: true,
        output: true,
        errorMessage: true,
      },
    });

    const updated = await prisma.forecast.update({
      where: { id: forecast.id },
      data: {
        status: 'FAILED',
        lastRunAt: now,
      },
      select: {
        id: true,
        status: true,
        lastRunAt: true,
      },
    });

    return {
      forecast: {
        id: updated.id,
        status: updated.status,
        lastRunAt: updated.lastRunAt?.toISOString() ?? null,
      },
      run: {
        id: run.id,
        status: run.status,
        ranAt: run.ranAt.toISOString(),
        output: run.output,
        errorMessage: run.errorMessage,
      },
    };
  }
}
