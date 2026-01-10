import 'server-only';

import type { Session } from 'next-auth';
import { Prisma } from '@ecom-os/prisma-kairos';

import prisma from '@/lib/prisma';
import { buildKairosOwnershipWhere, getKairosActor } from '@/lib/access';
import { runEtsForecast, type EtsRunConfig } from '@/lib/models/ets';
import { runProphetForecast, type ProphetRunConfig } from '@/lib/models/prophet';

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

export class ForecastAlreadyRunningError extends Error {
  constructor(message = 'This forecast is already running.') {
    super(message);
    this.name = 'ForecastAlreadyRunningError';
  }
}

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toProphetConfig(config: unknown): ProphetRunConfig | undefined {
  const obj = asObject(config);
  return obj ? (obj as ProphetRunConfig) : undefined;
}

function toEtsConfig(config: unknown): EtsRunConfig | undefined {
  const obj = asObject(config);
  return obj ? (obj as EtsRunConfig) : undefined;
}

async function pruneForecastRuns(tx: Prisma.TransactionClient, forecastId: string, keep: number) {
  const stale = await tx.forecastRun.findMany({
    where: { forecastId },
    orderBy: { ranAt: 'desc' },
    skip: keep,
    select: { id: true },
  });

  if (stale.length === 0) return;

  await tx.forecastRun.deleteMany({
    where: { id: { in: stale.map((row) => row.id) } },
  });
}

async function finalizeForecastRun(args: { forecastId: string; runId: string }) {
  try {
    const forecast = await prisma.forecast.findUnique({
      where: { id: args.forecastId },
      include: {
        series: {
          select: {
            id: true,
            source: true,
            query: true,
            geo: true,
            granularity: true,
          },
        },
      },
    });

    if (!forecast) {
      throw new Error('Forecast not found.');
    }

    const points = await prisma.timeSeriesPoint.findMany({
      where: { seriesId: forecast.seriesId },
      orderBy: { t: 'asc' },
      select: { t: true, value: true },
    });

    const ds = points.map((point) => Math.floor(point.t.getTime() / 1000));
    const y = points.map((point) => point.value);

    const config = forecast.config ?? undefined;

    const result =
      forecast.model === 'ETS'
        ? await runEtsForecast({
            ds,
            y,
            horizon: forecast.horizon,
            config: toEtsConfig(config),
          })
        : forecast.model === 'PROPHET'
          ? await runProphetForecast({
              ds,
              y,
              horizon: forecast.horizon,
              config: toProphetConfig(config),
            })
          : (() => {
              throw new Error(`Unsupported model: ${forecast.model}`);
            })();

    const completedAt = new Date();

    const output = {
      model: forecast.model,
      series: {
        id: forecast.series.id,
        source: forecast.series.source,
        query: forecast.series.query,
        geo: forecast.series.geo,
        granularity: forecast.series.granularity,
      },
      generatedAt: completedAt.toISOString(),
      points: result.points,
      meta: result.meta,
    };

    const outputJson = jsonSafe(output);
    const paramsJson = jsonSafe({
      model: forecast.model,
      horizon: forecast.horizon,
      config: forecast.config ?? null,
    });

    await prisma.$transaction(async (tx) => {
      await tx.forecastRun.update({
        where: { id: args.runId },
        data: {
          status: 'SUCCESS',
          output: outputJson,
          params: paramsJson,
          errorMessage: null,
        },
      });

      await tx.forecast.update({
        where: { id: args.forecastId },
        data: {
          status: 'READY',
          lastRunAt: completedAt,
        },
      });

      await pruneForecastRuns(tx, args.forecastId, 20);
    });
  } catch (error) {
    const completedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);
    const safeMessage = message.length > 2000 ? `${message.slice(0, 2000)}…` : message;

    await prisma.$transaction(async (tx) => {
      await tx.forecastRun.update({
        where: { id: args.runId },
        data: {
          status: 'FAILED',
          errorMessage: safeMessage,
        },
      });

      await tx.forecast.update({
        where: { id: args.forecastId },
        data: {
          status: 'FAILED',
          lastRunAt: completedAt,
        },
      });

      await pruneForecastRuns(tx, args.forecastId, 20);
    });
  }
}

export async function runForecastNow(args: { forecastId: string; session: Session }): Promise<RunResult | null> {
  const actor = getKairosActor(args.session);
  if (!actor.id && !actor.email) {
    throw new Error('User identity is missing.');
  }

  const startedAt = new Date();

  const started = await prisma.$transaction(async (tx) => {
    const forecast = await tx.forecast.findFirst({
      where: {
        id: args.forecastId,
        ...buildKairosOwnershipWhere(actor),
      },
      select: {
        id: true,
        status: true,
        model: true,
        horizon: true,
        config: true,
      },
    });

    if (!forecast) {
      return null;
    }

    if (forecast.status === 'RUNNING') {
      throw new ForecastAlreadyRunningError();
    }

    const updated = await tx.forecast.updateMany({
      where: {
        id: forecast.id,
        status: { not: 'RUNNING' },
      },
      data: {
        status: 'RUNNING',
        lastRunAt: startedAt,
      },
    });

    if (updated.count === 0) {
      throw new ForecastAlreadyRunningError();
    }

    const run = await tx.forecastRun.create({
      data: {
        forecastId: forecast.id,
        status: 'RUNNING',
        ranAt: startedAt,
        params: jsonSafe({
          model: forecast.model,
          horizon: forecast.horizon,
          config: forecast.config ?? null,
        }),
      },
      select: {
        id: true,
        status: true,
        ranAt: true,
        output: true,
        errorMessage: true,
      },
    });

    return {
      forecast: {
        id: forecast.id,
        status: 'RUNNING',
        lastRunAt: startedAt.toISOString(),
      },
      run: {
        id: run.id,
        status: run.status,
        ranAt: run.ranAt.toISOString(),
        output: run.output,
        errorMessage: run.errorMessage,
      },
    } satisfies RunResult;
  });

  if (!started) {
    return null;
  }

  void finalizeForecastRun({ forecastId: started.forecast.id, runId: started.run.id }).catch((error) => {
    console.error('[kairos] Forecast run background task crashed', error);
  });

  return started;
}
