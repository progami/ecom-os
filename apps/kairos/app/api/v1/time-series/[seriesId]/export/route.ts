import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withKairosAuth } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { buildKairosOwnershipWhere, getKairosActor } from '@/lib/access';

const paramsSchema = z.object({
  seriesId: z.string().min(1),
});

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

    const { seriesId } = paramsSchema.parse(safeParams);
    const actor = getKairosActor(session);

    const series = await prisma.timeSeries.findFirst({
      where: {
        id: seriesId,
        ...buildKairosOwnershipWhere(actor),
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!series) {
      return NextResponse.json({ error: 'Time series not found' }, { status: 404 });
    }

    const points = await prisma.timeSeriesPoint.findMany({
      where: { seriesId: series.id },
      orderBy: { t: 'asc' },
      select: { t: true, value: true },
    });

    const header = 't,value';
    const rows = points.map((point) => `${point.t.toISOString()},${point.value}`);
    const csv = [header, ...rows].join('\n') + '\n';

    const filenameBase = sanitizeFilename(series.name) || `series_${series.id}`;
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

