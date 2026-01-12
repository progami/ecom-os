import googleTrends from 'google-trends-api';

export type GoogleTrendsInterestPoint = {
  t: Date;
  value: number;
};

export type GoogleTrendsInterestOverTimeInput = {
  keyword: string;
  geo?: string;
  startDate: Date;
  endDate?: Date;
};

export type GoogleTrendsInterestOverTimeResult = {
  points: GoogleTrendsInterestPoint[];
  granularity: 'DAILY' | 'WEEKLY';
  sourceMeta: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stripGoogleTrendsPrefix(value: string) {
  return value.replace(/^\)\]\}',?\s*/, '');
}

function parseGoogleTrendsJson(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Google Trends returned an empty response.');
  }

  if (trimmed.startsWith('<')) {
    // Log first 1000 chars to diagnose what Google is returning
    console.error('[google-trends] Received HTML instead of JSON:', trimmed.slice(0, 1000));
    throw new Error('Google Trends returned HTML instead of JSON. Please retry in a minute.');
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const cleaned = stripGoogleTrendsPrefix(raw);
    try {
      return JSON.parse(cleaned) as unknown;
    } catch {
      throw new Error('Google Trends returned an unexpected response. Please retry.');
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchGoogleTrendsInterestOverTime(
  input: GoogleTrendsInterestOverTimeInput,
): Promise<GoogleTrendsInterestOverTimeResult> {
  const keyword = input.keyword.trim();
  if (!keyword) {
    throw new Error('Keyword is required.');
  }

  const endDate = input.endDate ?? new Date();
  const geo = input.geo?.trim() || undefined;

  const maxAttempts = 2;
  let raw = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      raw = await googleTrends.interestOverTime({
        keyword,
        startTime: input.startDate,
        endTime: endDate,
        geo,
      });
      break;
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }
      await sleep(750 * attempt);
    }
  }

  const parsed = parseGoogleTrendsJson(raw);
  const defaultBlock = isRecord(parsed) && isRecord(parsed.default) ? parsed.default : null;
  const timelineData = defaultBlock && Array.isArray(defaultBlock.timelineData) ? defaultBlock.timelineData : [];

  const points: GoogleTrendsInterestPoint[] = timelineData
    .map((row: any) => {
      const timeSeconds = Number(row?.time);
      const value = Array.isArray(row?.value) ? Number(row.value[0]) : Number(row?.value);
      const t = Number.isFinite(timeSeconds) ? new Date(timeSeconds * 1000) : new Date(NaN);
      return {
        t,
        value,
      };
    })
    .filter((point) => Number.isFinite(point.value) && !Number.isNaN(point.t.getTime()));

  if (points.length === 0) {
    throw new Error('Google Trends returned no data for this query.');
  }

  let granularity: 'DAILY' | 'WEEKLY' = 'DAILY';
  if (points.length >= 2) {
    const diffMs = points[1].t.getTime() - points[0].t.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays >= 6) {
      granularity = 'WEEKLY';
    }
  }

  const sourceMeta: Record<string, unknown> = {
    keyword,
    geo: geo ?? null,
    request: {
      startDate: input.startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    result: {
      title: typeof (defaultBlock as any)?.title === 'string' ? (defaultBlock as any).title : undefined,
    },
  };

  return { points, granularity, sourceMeta };
}
