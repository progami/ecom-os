import 'server-only';

import initEts, { AutoETS } from '@bsull/augurs/ets';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

type ForecastPoint = {
  t: string;
  yhat: number;
  yhatLower: number | null;
  yhatUpper: number | null;
  isFuture: boolean;
};

type ForecastMetrics = {
  sampleCount: number;
  mae: number | null;
  rmse: number | null;
  mape: number | null;
};

export type EtsRunConfig = {
  seasonLength?: number;
  spec?: string;
  intervalLevel?: number | null;
};

export type EtsRunResult = {
  points: ForecastPoint[];
  meta: {
    horizon: number;
    historyCount: number;
    intervalLevel: number | null;
    metrics: ForecastMetrics;
  };
};

let initPromise: Promise<void> | null = null;

const require = createRequire(import.meta.url);

async function ensureAugursEtsReady() {
  if (!initPromise) {
    initPromise = (async () => {
      const etsWasmPath = path.join(
        path.dirname(require.resolve('@bsull/augurs/ets')),
        'ets_bg.wasm',
      );

      const etsWasm = await readFile(etsWasmPath);
      await initEts({ module_or_path: etsWasm });
    })();
  }
  await initPromise;
}

function toIsoFromSeconds(seconds: number) {
  return new Date(seconds * 1000).toISOString();
}

function inferStepSeconds(ds: number[]): number {
  if (ds.length < 2) {
    return 60 * 60 * 24;
  }

  const last = ds[ds.length - 1] ?? 0;
  const prev = ds[ds.length - 2] ?? 0;
  const diff = last - prev;

  if (Number.isFinite(diff) && diff > 0) {
    return diff;
  }

  return 60 * 60 * 24;
}

export async function runEtsForecast(args: { ds: number[]; y: number[]; horizon: number; config?: EtsRunConfig }): Promise<EtsRunResult> {
  await ensureAugursEtsReady();

  if (args.ds.length !== args.y.length) {
    throw new Error('Training data length mismatch.');
  }
  if (args.ds.length < 2) {
    throw new Error('At least 2 observations are required.');
  }
  if (!Number.isInteger(args.horizon) || args.horizon < 1) {
    throw new Error('Horizon must be a positive integer.');
  }

  const seasonLength = args.config?.seasonLength ?? 7;
  const spec = args.config?.spec?.trim() || 'ZZZ';

  if (!Number.isInteger(seasonLength) || seasonLength < 1) {
    throw new Error('ETS season length must be a positive integer.');
  }

  const intervalLevel = args.config?.intervalLevel ?? 0.8;
  if (intervalLevel !== null && (typeof intervalLevel !== 'number' || intervalLevel <= 0 || intervalLevel >= 1)) {
    throw new Error('ETS interval level must be between 0 and 1, or null to disable intervals.');
  }

  const model = new AutoETS(seasonLength, spec);
  model.fit(args.y);

  const forecast = model.predict(args.horizon, intervalLevel);

  const stepSeconds = inferStepSeconds(args.ds);
  const lastDs = args.ds[args.ds.length - 1] ?? 0;

  const points: ForecastPoint[] = forecast.point.map((value, index) => {
    const nextSeconds = lastDs + stepSeconds * (index + 1);
    const lower = forecast.intervals?.lower?.[index];
    const upper = forecast.intervals?.upper?.[index];
    return {
      t: toIsoFromSeconds(nextSeconds),
      yhat: value,
      yhatLower: typeof lower === 'number' ? lower : null,
      yhatUpper: typeof upper === 'number' ? upper : null,
      isFuture: true,
    };
  }).filter((row) => Number.isFinite(row.yhat));

  return {
    points,
    meta: {
      horizon: args.horizon,
      historyCount: args.ds.length,
      intervalLevel: forecast.intervals?.level ?? null,
      metrics: { sampleCount: 0, mae: null, rmse: null, mape: null },
    },
  };
}

