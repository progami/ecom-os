export type TimeSeriesSource = 'GOOGLE_TRENDS';

export type TimeSeriesGranularity = 'DAILY' | 'WEEKLY';

export type TimeSeriesListItem = {
  id: string;
  name: string;
  source: TimeSeriesSource;
  granularity: TimeSeriesGranularity;
  query: string;
  geo: string | null;
  pointsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ForecastModel = 'PROPHET' | 'ETS';

export type ForecastStatus = 'DRAFT' | 'RUNNING' | 'READY' | 'FAILED';

export type ForecastListItem = {
  id: string;
  name: string;
  model: ForecastModel;
  horizon: number;
  status: ForecastStatus;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  series: Pick<
    TimeSeriesListItem,
    'id' | 'name' | 'source' | 'granularity' | 'query' | 'geo'
  >;
};

export type ForecastRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';

export type ForecastOutputPoint = {
  t: string;
  yhat: number;
  yhatLower: number | null;
  yhatUpper: number | null;
  isFuture: boolean;
};

export type ForecastOutputMetrics = {
  sampleCount: number;
  mae: number | null;
  rmse: number | null;
  mape: number | null;
};

export type ForecastOutput = {
  model: ForecastModel;
  series: {
    id: string;
    source: TimeSeriesSource;
    query: string;
    geo: string | null;
    granularity: TimeSeriesGranularity;
  };
  generatedAt: string;
  points: ForecastOutputPoint[];
  meta: {
    horizon: number;
    historyCount: number;
    intervalLevel: number | null;
    metrics?: ForecastOutputMetrics;
  };
};

export type ProphetOutput = ForecastOutput & { model: 'PROPHET' };
export type EtsOutput = ForecastOutput & { model: 'ETS' };

export type SeasonalityToggle = 'auto' | 'on' | 'off';

export type ProphetForecastConfig = {
  intervalWidth?: number;
  uncertaintySamples?: number;
  seasonalityMode?: 'additive' | 'multiplicative';
  yearlySeasonality?: SeasonalityToggle;
  weeklySeasonality?: SeasonalityToggle;
  dailySeasonality?: SeasonalityToggle;
};

export type EtsForecastConfig = {
  seasonLength?: number;
  spec?: string;
  intervalLevel?: number | null;
};

export type ForecastConfig = ProphetForecastConfig | EtsForecastConfig;

export type ForecastDetail = {
  id: string;
  name: string;
  model: ForecastModel;
  horizon: number;
  config: ForecastConfig | null;
  status: ForecastStatus;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  series: {
    id: string;
    name: string;
    source: TimeSeriesSource;
    granularity: TimeSeriesGranularity;
    query: string;
    geo: string | null;
    createdAt: string;
    updatedAt: string;
  };
  points: Array<{ t: string; value: number }>;
  latestRun: {
    id: string;
    status: ForecastRunStatus;
    ranAt: string;
    errorMessage: string | null;
    output: unknown;
  } | null;
};
