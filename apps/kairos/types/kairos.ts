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

export type ForecastModel = 'PROPHET';

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

export type ForecastRunStatus = 'SUCCESS' | 'FAILED';

export type ProphetOutputPoint = {
  t: string;
  yhat: number;
  yhatLower: number | null;
  yhatUpper: number | null;
  isFuture: boolean;
};

export type ProphetOutput = {
  model: 'PROPHET';
  series: {
    id: string;
    source: TimeSeriesSource;
    query: string;
    geo: string | null;
    granularity: TimeSeriesGranularity;
  };
  generatedAt: string;
  points: ProphetOutputPoint[];
  meta: {
    horizon: number;
    historyCount: number;
    intervalLevel: number | null;
  };
};

export type ForecastDetail = {
  id: string;
  name: string;
  model: ForecastModel;
  horizon: number;
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

