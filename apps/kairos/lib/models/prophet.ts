import 'server-only';

import initProphet, { Prophet, type ProphetSeasonalityOption } from '@bsull/augurs/prophet';
import initTransforms, { Pipeline } from '@bsull/augurs/transforms';
import { optimizer } from '@bsull/augurs-prophet-wasmstan';

import { withFileUrlFetch } from './wasm';

type ForecastPoint = {
  t: string;
  yhat: number;
  yhatLower: number | null;
  yhatUpper: number | null;
  isFuture: boolean;
};

export type ProphetRunResult = {
  points: ForecastPoint[];
  meta: {
    horizon: number;
    historyCount: number;
    intervalLevel: number | null;
    metrics: ForecastMetrics;
  };
};

export type ProphetSeasonalityToggle = 'auto' | 'on' | 'off';

export type ProphetRunConfig = {
  intervalWidth?: number;
  uncertaintySamples?: number;
  seasonalityMode?: 'additive' | 'multiplicative';
  yearlySeasonality?: ProphetSeasonalityToggle;
  weeklySeasonality?: ProphetSeasonalityToggle;
  dailySeasonality?: ProphetSeasonalityToggle;
};

type ForecastMetrics = {
  sampleCount: number;
  mae: number | null;
  rmse: number | null;
  mape: number | null;
};

let initPromise: Promise<void> | null = null;

async function ensureAugursReady() {
  if (!initPromise) {
    initPromise = withFileUrlFetch(async () => {
      await Promise.all([initProphet(), initTransforms()]);
    });
  }
  await initPromise;
}

function toIsoFromSeconds(seconds: number) {
  return new Date(seconds * 1000).toISOString();
}

function seasonalityOption(toggle: ProphetSeasonalityToggle | undefined): ProphetSeasonalityOption | undefined {
  if (!toggle) return undefined;
  if (toggle === 'auto') return { type: 'auto' };
  return { type: 'manual', enabled: toggle === 'on' };
}

function computeMetrics(actual: number[], predicted: number[]): ForecastMetrics {
  const errors: number[] = [];
  const mapeTerms: number[] = [];

  for (let index = 0; index < actual.length && index < predicted.length; index += 1) {
    const y = actual[index];
    const yhat = predicted[index];

    if (!Number.isFinite(y) || !Number.isFinite(yhat)) {
      continue;
    }

    const error = yhat - y;
    errors.push(error);

    if (y !== 0) {
      mapeTerms.push(Math.abs(error / y));
    }
  }

  if (errors.length === 0) {
    return { sampleCount: 0, mae: null, rmse: null, mape: null };
  }

  const mae = errors.reduce((sum, value) => sum + Math.abs(value), 0) / errors.length;
  const rmse = Math.sqrt(errors.reduce((sum, value) => sum + value * value, 0) / errors.length);

  const mape =
    mapeTerms.length > 0 ? mapeTerms.reduce((sum, value) => sum + value, 0) / mapeTerms.length : null;

  return { sampleCount: errors.length, mae, rmse, mape };
}

export async function runProphetForecast(args: { ds: number[]; y: number[]; horizon: number; config?: ProphetRunConfig }): Promise<ProphetRunResult> {
  await ensureAugursReady();

  if (args.ds.length !== args.y.length) {
    throw new Error('Training data length mismatch.');
  }
  if (args.ds.length < 2) {
    throw new Error('At least 2 observations are required.');
  }
  if (!Number.isInteger(args.horizon) || args.horizon < 1) {
    throw new Error('Horizon must be a positive integer.');
  }

  const pipeline = new Pipeline([{ type: 'yeoJohnson' }, { type: 'standardScaler' }]);
  const yTransformed = pipeline.fitTransform(args.y);

  const model = new Prophet({
    optimizer,
    intervalWidth: args.config?.intervalWidth,
    uncertaintySamples: args.config?.uncertaintySamples,
    seasonalityMode: args.config?.seasonalityMode,
    yearlySeasonality: seasonalityOption(args.config?.yearlySeasonality),
    weeklySeasonality: seasonalityOption(args.config?.weeklySeasonality),
    dailySeasonality: seasonalityOption(args.config?.dailySeasonality),
  });
  model.fit({ ds: args.ds, y: yTransformed });

  const predictionData = model.makeFutureDataframe(args.horizon, { includeHistory: true });
  const preds = model.predict(predictionData);

  const yhatPoint = Array.from(pipeline.inverseTransform(preds.yhat.point));

  const intervalLevel = preds.yhat.intervals?.level ?? null;
  const yhatLower = preds.yhat.intervals?.lower
    ? Array.from(pipeline.inverseTransform(preds.yhat.intervals.lower))
    : null;
  const yhatUpper = preds.yhat.intervals?.upper
    ? Array.from(pipeline.inverseTransform(preds.yhat.intervals.upper))
    : null;

  const historyCount = args.ds.length;
  const metrics = computeMetrics(args.y, yhatPoint.slice(0, historyCount));
  const points: ForecastPoint[] = preds.ds.map((dsSeconds, index) => ({
    t: toIsoFromSeconds(dsSeconds),
    yhat: yhatPoint[index] ?? NaN,
    yhatLower: yhatLower ? (yhatLower[index] ?? null) : null,
    yhatUpper: yhatUpper ? (yhatUpper[index] ?? null) : null,
    isFuture: index >= historyCount,
  })).filter((row) => Number.isFinite(row.yhat));

  return {
    points,
    meta: {
      horizon: args.horizon,
      historyCount,
      intervalLevel,
      metrics,
    },
  };
}
