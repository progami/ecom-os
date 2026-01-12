import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withKairosAuth } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { buildKairosOwnershipWhere, getKairosActor } from '@/lib/access';

const paramsSchema = z.object({
  forecastId: z.string().min(1),
});

type ForecastOutputPoint = {
  t: string;
  yhat: number;
  yhatLower: number | null;
  yhatUpper: number | null;
  isFuture: boolean;
};

function isForecastOutputPoint(value: unknown): value is ForecastOutputPoint {
  if (!value || typeof value !== 'object') return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.t === 'string' &&
    typeof rec.yhat === 'number' &&
    (rec.yhatLower === null || typeof rec.yhatLower === 'number') &&
    (rec.yhatUpper === null || typeof rec.yhatUpper === 'number') &&
    typeof rec.isFuture === 'boolean'
  );
}

function parseOutputPoints(value: unknown): ForecastOutputPoint[] | null {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  if (!Array.isArray(rec.points)) return null;

  const points = rec.points.filter(isForecastOutputPoint);
  return points.length > 0 ? points : null;
}

function sanitizeFilename(value: string) {
  return value
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

export const GET = withKairosAuth(async (_request, session, context: { params: Promise<unknown> }) => {
  try {
    const rawParams = await context.params;
    const safeParams =
      rawParams && typeof rawParams === 'object'
        ? { ...(rawParams as Record<string, unknown>), then: undefined }
        : rawParams;

    const { forecastId } = paramsSchema.parse(safeParams);
    const actor = getKairosActor(session);

    const forecast = await prisma.forecast.findFirst({
      where: {
        id: forecastId,
        ...buildKairosOwnershipWhere(actor),
      },
      include: {
        targetSeries: { select: { id: true, name: true } },
        runs: {
          orderBy: { ranAt: 'desc' },
          take: 1,
          select: { id: true, status: true, ranAt: true, output: true },
        },
      },
    });

    if (!forecast) {
      return NextResponse.json({ error: 'Forecast not found' }, { status: 404 });
    }

    const points = await prisma.timeSeriesPoint.findMany({
      where: { seriesId: forecast.targetSeriesId },
      orderBy: { t: 'asc' },
      select: { t: true, value: true },
    });

    const actualMap = new Map<string, number>();
    for (const point of points) {
      actualMap.set(point.t.toISOString(), point.value);
    }

    const latestRun = forecast.runs[0] ?? null;
    const latestSuccessfulRun =
      latestRun?.status === 'SUCCESS'
        ? latestRun
        : await prisma.forecastRun.findFirst({
            where: { forecastId: forecast.id, status: 'SUCCESS' },
            orderBy: { ranAt: 'desc' },
            select: { id: true, status: true, ranAt: true, output: true },
          });

    const outputPoints = parseOutputPoints(latestSuccessfulRun?.output);

    const outputMap = new Map<string, ForecastOutputPoint>();
    for (const point of outputPoints ?? []) {
      outputMap.set(point.t, point);
    }

    const timestamps = new Set<string>();
    for (const point of points) {
      timestamps.add(point.t.toISOString());
    }
    for (const point of outputMap.values()) {
      timestamps.add(point.t);
    }

    const header = 't,actual,yhat,yhatLower,yhatUpper,isFuture';
    const rows = Array.from(timestamps)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((t) => {
        const actual = actualMap.get(t) ?? '';
        const predicted = outputMap.get(t);
        if (!predicted) {
          return `${t},${actual},,,,`;
        }

        const yhatLower = predicted.yhatLower ?? '';
        const yhatUpper = predicted.yhatUpper ?? '';
        return `${t},${actual},${predicted.yhat},${yhatLower},${yhatUpper},${predicted.isFuture}`;
      });

    const csv = [header, ...rows].join('\n') + '\n';

    const filenameBase = sanitizeFilename(forecast.name) || `forecast_${forecast.id}`;
    const filename = `${filenameBase}.csv`;

    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
