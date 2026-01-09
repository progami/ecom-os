import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@ecom-os/prisma-chronos';

import { withChronosAuth } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { getChronosActor } from '@/lib/access';
import { fetchGoogleTrendsInterestOverTime } from '@/lib/sources/google-trends';

const payloadSchema = z.object({
  keyword: z.string().trim().min(1),
  geo: z.string().trim().optional().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  name: z.string().trim().min(1).optional(),
});

function parseDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

export const POST = withChronosAuth(async (request, session) => {
  const json = await request.json().catch(() => null);
  const payload = payloadSchema.parse(json);

  const startDate = parseDate(payload.startDate);
  const endDate = payload.endDate ? parseDate(payload.endDate) : undefined;

  const result = await fetchGoogleTrendsInterestOverTime({
    keyword: payload.keyword,
    geo: payload.geo || undefined,
    startDate,
    endDate,
  });

  const actor = getChronosActor(session);
  const name =
    payload.name ??
    `Google Trends: ${payload.keyword}${payload.geo ? ` (${payload.geo})` : ''}`;

  const sourceMetaJson = JSON.parse(JSON.stringify(result.sourceMeta)) as Prisma.InputJsonValue;

  const series = await prisma.timeSeries.create({
    data: {
      name,
      source: 'GOOGLE_TRENDS',
      granularity: result.granularity,
      query: payload.keyword,
      geo: payload.geo || null,
      sourceMeta: sourceMetaJson,
      createdById: actor.id,
      createdByEmail: actor.email,
    },
    select: {
      id: true,
      name: true,
      source: true,
      granularity: true,
      query: true,
      geo: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await prisma.timeSeriesPoint.createMany({
    data: result.points.map((point) => ({
      seriesId: series.id,
      t: point.t,
      value: point.value,
    })),
    skipDuplicates: true,
  });

  const pointsCount = await prisma.timeSeriesPoint.count({
    where: { seriesId: series.id },
  });

  return NextResponse.json({
    series: {
      id: series.id,
      name: series.name,
      source: series.source,
      granularity: series.granularity,
      query: series.query,
      geo: series.geo,
      pointsCount,
      createdAt: series.createdAt.toISOString(),
      updatedAt: series.updatedAt.toISOString(),
    },
  });
});
