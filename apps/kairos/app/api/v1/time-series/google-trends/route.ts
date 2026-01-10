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

function readStringPath(meta: unknown, path: string[]): string | null {
  let current: unknown = meta;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : null;
}

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
        sourceMeta: true,
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
          sourceTitle: readStringPath(cached.sourceMeta, ['result', 'title']),
          importStartDate: readStringPath(cached.sourceMeta, ['request', 'startDate']),
          importEndDate: readStringPath(cached.sourceMeta, ['request', 'endDate']),
          pointsCount: cached._count.points,
          createdAt: cached.createdAt.toISOString(),
          updatedAt: cached.updatedAt.toISOString(),
        },
        import: {
          mode: 'CACHED',
          insertedPoints: 0,
          deletedPoints: 0,
          totalPoints: cached._count.points,
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

    const sourceMetaBase = JSON.parse(JSON.stringify(result.sourceMeta)) as Record<string, unknown>;

    const { series, pointsCount, insertedPoints, deletedPoints, importMode, sourceMetaFinal } =
      await prisma.$transaction(async (tx) => {
      const importedAt = new Date().toISOString();
      const series = cached
        ? await tx.timeSeries.update({
            where: { id: cached.id },
            data: {
              name,
              granularity: result.granularity,
            },
            select: {
              id: true,
              name: true,
              source: true,
              granularity: true,
              query: true,
              geo: true,
              sourceMeta: true,
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
              sourceMeta: sourceMetaBase as Prisma.InputJsonValue,
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
              sourceMeta: true,
              createdAt: true,
              updatedAt: true,
            },
          });

      const shouldReplace = Boolean(cached) && payload.force;
      const deleted = shouldReplace
        ? await tx.timeSeriesPoint.deleteMany({ where: { seriesId: series.id } })
        : { count: 0 };

      const created = await tx.timeSeriesPoint.createMany({
        data: result.points.map((point) => ({
          seriesId: series.id,
          t: point.t,
          value: point.value,
        })),
        skipDuplicates: !shouldReplace,
      });

      const pointsCount = await tx.timeSeriesPoint.count({
        where: { seriesId: series.id },
      });

      const importMode = cached ? (shouldReplace ? 'REPLACE' : 'MERGE') : 'CREATE';

      const sourceMetaFinal = {
        ...sourceMetaBase,
        import: {
          mode: importMode,
          insertedPoints: created.count,
          deletedPoints: deleted.count,
          totalPoints: pointsCount,
          importedAt,
        },
      } satisfies Record<string, unknown>;

      await tx.timeSeries.update({
        where: { id: series.id },
        data: { sourceMeta: sourceMetaFinal as Prisma.InputJsonValue },
      });

      return {
        series,
        pointsCount,
        insertedPoints: created.count,
        deletedPoints: deleted.count,
        importMode,
        sourceMetaFinal,
      };
    });

    return NextResponse.json({
      series: {
        id: series.id,
        name: series.name,
        source: series.source,
        granularity: series.granularity,
        query: series.query,
        geo: series.geo,
        sourceTitle: readStringPath(sourceMetaFinal, ['result', 'title']),
        importStartDate: readStringPath(sourceMetaFinal, ['request', 'startDate']),
        importEndDate: readStringPath(sourceMetaFinal, ['request', 'endDate']),
        pointsCount,
        createdAt: series.createdAt.toISOString(),
        updatedAt: series.updatedAt.toISOString(),
      },
      import: {
        mode: importMode,
        insertedPoints,
        deletedPoints,
        totalPoints: pointsCount,
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
