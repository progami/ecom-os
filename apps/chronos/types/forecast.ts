export type ForecastMarketplace = 'US' | 'CA' | 'UK';

export type ForecastFrequency = 'Weekly' | 'Monthly';

export type ForecastSignal =
  | 'Amazon Brand Analytics'
  | 'Amazon Product Guidance'
  | 'Google Trends';

export type ForecastModel = 'Prophet';

export type ForecastProjectStatus = 'draft' | 'ready' | 'running' | 'failed';

export type ForecastProject = {
  id: string;
  name: string;
  marketplace: ForecastMarketplace;
  horizonWeeks: number;
  frequency: ForecastFrequency;
  sources: ForecastSignal[];
  model: ForecastModel;
  lastRunAt: string | null;
  status: ForecastProjectStatus;
};

