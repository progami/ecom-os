import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@ecom-os/prisma-kairos';

import { withKairosAuth } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { buildKairosOwnershipWhere, getKairosActor } from '@/lib/access';

const querySchema = z
  .object({
    q: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.enum(['updatedAt', 'name']).optional().default('updatedAt'),
    dir: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .strict();

function readStringPath(meta: unknown, path: string[]): string | null {
  let current: unknown = meta;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : null;
}

export const GET = withKairosAuth(async (request, session) => {
  try {
    const actor = getKairosActor(session);

    const params = new URL(request.url).searchParams;
    const query = querySchema.parse({
      q: params.get('q') ?? undefined,
      page: params.get('page') ?? undefined,
      pageSize: params.get('pageSize') ?? undefined,
      sort: params.get('sort') ?? undefined,
      dir: params.get('dir') ?? undefined,
    });

    const where = {
      ...buildKairosOwnershipWhere(actor),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' as const } },
              { query: { contains: query.q, mode: 'insensitive' as const } },
              { geo: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const orderBy =
      query.sort === 'name'
        ? [{ name: query.dir }, { updatedAt: 'desc' as const }]
        : [{ updatedAt: query.dir }, { name: 'asc' as const }];

    const shouldPaginate = typeof query.page === 'number' && typeof query.pageSize === 'number';
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const [totalCount, series] = await Promise.all([
      prisma.timeSeries.count({ where }),
      prisma.timeSeries.findMany({
        where,
        orderBy,
        ...(shouldPaginate ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
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
      }),
    ]);

    return NextResponse.json({
      series: series.map((row) => ({
        id: row.id,
        name: row.name,
        source: row.source,
        granularity: row.granularity,
        query: row.query,
        geo: row.geo,
        sourceTitle: readStringPath(row.sourceMeta, ['result', 'title']),
        importStartDate: readStringPath(row.sourceMeta, ['request', 'startDate']),
        importEndDate: readStringPath(row.sourceMeta, ['request', 'endDate']),
        pointsCount: row._count.points,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      totalCount,
      page,
      pageSize: shouldPaginate ? pageSize : totalCount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.at(0)?.message ?? 'Invalid request.' },
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

    const message = error instanceof Error ? error.message : 'Request failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
