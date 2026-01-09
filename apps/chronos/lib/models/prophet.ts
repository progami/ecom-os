import initProphet, { Prophet } from '@bsull/augurs/prophet';
import initTransforms, { Pipeline } from '@bsull/augurs/transforms';
import { optimizer } from '@bsull/augurs-prophet-wasmstan';

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
  };
};

let initPromise: Promise<void> | null = null;

async function ensureAugursReady() {
  if (!initPromise) {
    initPromise = Promise.all([initProphet(), initTransforms()]).then(() => undefined);
  }
  await initPromise;
}

function toIsoFromSeconds(seconds: number) {
  return new Date(seconds * 1000).toISOString();
}

export async function runProphetForecast(args: { ds: number[]; y: number[]; horizon: number }): Promise<ProphetRunResult> {
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

  const model = new Prophet({ optimizer });
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
    },
  };
}

