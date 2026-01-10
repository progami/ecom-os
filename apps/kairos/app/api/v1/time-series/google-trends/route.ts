import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@ecom-os/prisma-kairos';

import { withKairosAuth } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { buildKairosOwnershipWhere, getKairosActor } from '@/lib/access';
import { fetchGoogleTrendsInterestOverTime } from '@/lib/sources/google-trends';

const payloadSchema = z.object({
  keyword: z.string().trim().min(1),
  geo: z.string().trim().optional().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  name: z.string().trim().min(1).optional(),
  force: z.coerce.boolean().optional().default(false),
});

function parseDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

export const POST = withKairosAuth(async (request, session) => {
  try {
    const json = await request.json().catch(() => null);
    const payload = payloadSchema.parse(json);

    const actor = getKairosActor(session);
    if (!actor.id && !actor.email) {
      return NextResponse.json({ error: 'User identity is missing.' }, { status: 403 });
    }

    const startDate = parseDate(payload.startDate);
    const endDate = payload.endDate ? parseDate(payload.endDate) : undefined;
    const resolvedEndDate = endDate ?? new Date();

    const startIso = startDate.toISOString();
    const endIso = resolvedEndDate.toISOString();

    const cached = await prisma.timeSeries.findFirst({
      where: {
        source: 'GOOGLE_TRENDS',
        query: payload.keyword,
        geo: payload.geo || null,
        ...buildKairosOwnershipWhere(actor),
        AND: [
          {
            sourceMeta: {
              path: ['request', 'startDate'],
              equals: startIso,
            },
          },
          {
            sourceMeta: {
              path: ['request', 'endDate'],
              equals: endIso,
            },
          },
        ],
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
        _count: { select: { points: true } },
      },
    });

    if (cached && !payload.force && cached._count.points > 0) {
      return NextResponse.json({
        series: {
          id: cached.id,
          name: cached.name,
          source: cached.source,
          granularity: cached.granularity,
          query: cached.query,
          geo: cached.geo,
          pointsCount: cached._count.points,
          createdAt: cached.createdAt.toISOString(),
          updatedAt: cached.updatedAt.toISOString(),
        },
      });
    }

    const result = await fetchGoogleTrendsInterestOverTime({
      keyword: payload.keyword,
      geo: payload.geo || undefined,
      startDate,
      endDate: resolvedEndDate,
    });

    const name =
      payload.name ??
      cached?.name ??
      `Google Trends: ${payload.keyword}${payload.geo ? ` (${payload.geo})` : ''}`;

    const sourceMetaJson = JSON.parse(JSON.stringify(result.sourceMeta)) as Prisma.InputJsonValue;

    const { series, pointsCount } = await prisma.$transaction(async (tx) => {
      const series = cached
        ? await tx.timeSeries.update({
            where: { id: cached.id },
            data: {
              name,
              granularity: result.granularity,
              sourceMeta: sourceMetaJson,
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
          })
        : await tx.timeSeries.create({
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

      await tx.timeSeriesPoint.createMany({
        data: result.points.map((point) => ({
          seriesId: series.id,
          t: point.t,
          value: point.value,
        })),
        skipDuplicates: true,
      });

      const pointsCount = await tx.timeSeriesPoint.count({
        where: { seriesId: series.id },
      });

      return { series, pointsCount };
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
  } catch (error) {
    console.error('[kairos] Google Trends import failed', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.at(0)?.message ?? 'Invalid request payload.' },
        { status: 400 },
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const message =
        error.code === 'P2021'
          ? 'Kairos database tables are missing. Please run migrations.'
          : 'Database error. Please try again.';
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const message = error instanceof Error ? error.message : 'Import failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
