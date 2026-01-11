import 'server-only';

import type { Session } from 'next-auth';
import { Prisma } from '@targon/prisma-kairos';
import { ZodError } from 'zod';

import prisma from '@/lib/prisma';
import { buildKairosOwnershipWhere, getKairosActor } from '@/lib/access';
import { parseEtsConfig, parseProphetConfig } from '@/lib/forecasts/config';
import { runMlForecast } from '@/lib/models/ml-service';

type ForecastModel = 'ETS' | 'PROPHET';

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
  const totalStart = Date.now();
  try {
    const runState = await prisma.forecastRun.findUnique({
      where: { id: args.runId },
      select: { status: true, params: true },
    });

    if (runState?.status !== 'RUNNING') {
      return;
    }

    const params = runState.params;
    if (!params || typeof params !== 'object') {
      throw new Error('Forecast run parameters are missing.');
    }

    const paramsRec = params as Record<string, unknown>;
    const model = paramsRec.model;
    if (model !== 'ETS' && model !== 'PROPHET') {
      throw new Error('Forecast run model is missing.');
    }

    const horizon = paramsRec.horizon;
    if (typeof horizon !== 'number' || !Number.isFinite(horizon) || !Number.isInteger(horizon)) {
      throw new Error('Forecast run horizon is missing.');
    }

    const config = paramsRec.config;

    const loadStart = Date.now();
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

    if (forecast.status !== 'RUNNING') {
      throw new Error('Forecast is no longer running.');
    }

    const points = await prisma.timeSeriesPoint.findMany({
      where: { seriesId: forecast.seriesId },
      orderBy: { t: 'asc' },
      select: { t: true, value: true },
    });

    const ds = points.map((point) => Math.floor(point.t.getTime() / 1000));
    const y = points.map((point) => point.value);

    const loadMs = Date.now() - loadStart;

    const modelStart = Date.now();
    const result = await (async () => {
      if (model === 'ETS') {
        try {
          const parsedConfig = parseEtsConfig(config) ?? undefined;
          return await runMlForecast({ model: 'ETS', ds, y, horizon, config: parsedConfig });
        } catch (error) {
          if (error instanceof ZodError) {
            throw new Error(error.issues.at(0)?.message ?? 'Invalid forecast configuration.');
          }
          throw error;
        }
      }

      if (model === 'PROPHET') {
        try {
          const parsedConfig = parseProphetConfig(config) ?? undefined;
          return await runMlForecast({ model: 'PROPHET', ds, y, horizon, config: parsedConfig });
        } catch (error) {
          if (error instanceof ZodError) {
            throw new Error(error.issues.at(0)?.message ?? 'Invalid forecast configuration.');
          }
          throw error;
        }
      }

      throw new Error(`Unsupported model: ${model}`);
    })();

    const modelMs = Date.now() - modelStart;
    const completedAt = new Date();

    const output = {
      model,
      series: {
        id: forecast.series.id,
        source: forecast.series.source,
        query: forecast.series.query,
        geo: forecast.series.geo,
        granularity: forecast.series.granularity,
      },
      generatedAt: completedAt.toISOString(),
      points: result.points,
      meta: {
        ...result.meta,
        timings: {
          loadMs,
          modelMs,
          saveMs: 0,
          totalMs: 0,
        },
      },
    };

    const paramsJson = jsonSafe({
      model,
      horizon,
      config: config === undefined ? null : config,
    });

    const outputJson = jsonSafe(output);
    const saveStart = Date.now();
    await prisma.$transaction(async (tx) => {
      const updatedRun = await tx.forecastRun.updateMany({
        where: { id: args.runId, status: 'RUNNING' },
        data: {
          status: 'SUCCESS',
          output: outputJson,
          params: paramsJson,
          errorMessage: null,
        },
      });

      await tx.forecast.updateMany({
        where: { id: args.forecastId, status: 'RUNNING' },
        data: {
          status: 'READY',
          lastRunAt: completedAt,
        },
      });

      if (updatedRun.count > 0) {
        await pruneForecastRuns(tx, args.forecastId, 20);
      }
    });

    const saveMs = Date.now() - saveStart;
    const totalMs = Date.now() - totalStart;
    const outputWithTimingsJson = jsonSafe({
      ...output,
      meta: {
        ...output.meta,
        timings: {
          ...output.meta.timings,
          saveMs,
          totalMs,
        },
      },
    });

    await prisma.forecastRun.updateMany({
      where: { id: args.runId, status: 'SUCCESS' },
      data: { output: outputWithTimingsJson },
    });
  } catch (error) {
    const completedAt = new Date();
    const message = error instanceof Error ? error.message : String(error);
    const safeMessage = message.length > 2000 ? `${message.slice(0, 2000)}…` : message;

    await prisma.$transaction(async (tx) => {
      await tx.forecastRun.updateMany({
        where: { id: args.runId, status: 'RUNNING' },
        data: {
          status: 'FAILED',
          errorMessage: safeMessage,
        },
      });

      await tx.forecast.updateMany({
        where: { id: args.forecastId, status: 'RUNNING' },
        data: {
          status: 'FAILED',
          lastRunAt: completedAt,
        },
      });

      await pruneForecastRuns(tx, args.forecastId, 20);
    });
  }
}

type PendingForecastRun = { forecastId: string; runId: string };

const forecastRunQueue: PendingForecastRun[] = [];
let forecastRunWorker: Promise<void> | null = null;

async function processForecastRunQueue() {
  while (true) {
    const next =
      forecastRunQueue.shift() ??
      (await prisma.forecastRun.findFirst({
        where: { status: 'RUNNING' },
        orderBy: { ranAt: 'asc' },
        select: { id: true, forecastId: true },
      }));

    if (!next) {
      return;
    }

    const job = 'runId' in next ? next : { runId: next.id, forecastId: next.forecastId };
    await finalizeForecastRun(job);
  }
}

function kickForecastRunWorker() {
  if (forecastRunWorker) return;
  forecastRunWorker = processForecastRunQueue()
    .catch((error) => {
      console.error('[kairos] Forecast run worker crashed', error);
    })
    .finally(() => {
      forecastRunWorker = null;
    });
}

export async function runForecastNow(args: {
  forecastId: string;
  session: Session;
  model?: ForecastModel;
  config?: unknown;
}): Promise<RunResult | null> {
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

    let runModel: ForecastModel = forecast.model;
    let runConfig: unknown = forecast.config;

    if (args.model) {
      runModel = args.model;
      if (args.config !== undefined) {
        runConfig = args.config;
      } else {
        runConfig = null;
      }
    } else if (args.config !== undefined) {
      runConfig = args.config;
    }

    const run = await tx.forecastRun.create({
      data: {
        forecastId: forecast.id,
        status: 'RUNNING',
        ranAt: startedAt,
        params: jsonSafe({
          model: runModel,
          horizon: forecast.horizon,
          config: runConfig === undefined ? null : runConfig,
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

  forecastRunQueue.push({ forecastId: started.forecast.id, runId: started.run.id });
  kickForecastRunWorker();

  return started;
}
