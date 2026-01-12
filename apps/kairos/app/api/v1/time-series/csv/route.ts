import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@targon/prisma-kairos';

import { withKairosAuth } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { getKairosActor } from '@/lib/access';
import { parseCSVToTimeSeries, getCSVPreview } from '@/lib/sources/csv';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const uploadSchema = z.object({
  name: z.string().trim().min(1),
  dateColumn: z.string().trim().min(1),
  valueColumn: z.string().trim().min(1),
  productColumn: z.string().trim().optional(),
});

export const POST = withKairosAuth(async (request, session) => {
  try {
    const actor = getKairosActor(session);
    if (!actor.id && !actor.email) {
      return NextResponse.json({ error: 'User identity is missing.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'CSV file is required.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit.' }, { status: 400 });
    }

    const content = await file.text();

    // Check if this is a preview request
    const previewOnly = formData.get('preview') === 'true';
    if (previewOnly) {
      const preview = getCSVPreview(content);
      return NextResponse.json({ preview });
    }

    // Parse upload options
    const options = uploadSchema.parse({
      name: formData.get('name'),
      dateColumn: formData.get('dateColumn'),
      valueColumn: formData.get('valueColumn'),
      productColumn: formData.get('productColumn') || undefined,
    });

    // Parse CSV to time series
    const results = parseCSVToTimeSeries(content, {
      dateColumn: options.dateColumn,
      valueColumn: options.valueColumn,
      productColumn: options.productColumn,
    });

    if (results.length === 0) {
      return NextResponse.json({ error: 'No valid data found in CSV.' }, { status: 400 });
    }

    const importedAt = new Date().toISOString();
    const createdSeries: Array<{
      id: string;
      name: string;
      source: string;
      granularity: string;
      query: string;
      geo: string | null;
      pointsCount: number;
      createdAt: string;
      updatedAt: string;
    }> = [];

    await prisma.$transaction(async (tx) => {
      for (const result of results) {
        const seriesName = result.productKey
          ? `${options.name} - ${result.productKey}`
          : options.name;

        const query = result.productKey ?? options.name;

        const sourceMeta = {
          fileName: file.name,
          fileSize: file.size,
          dateColumn: options.dateColumn,
          valueColumn: options.valueColumn,
          productColumn: options.productColumn ?? null,
          productKey: result.productKey ?? null,
          import: {
            mode: 'CREATE',
            insertedPoints: result.points.length,
            totalPoints: result.points.length,
            importedAt,
          },
        };

        const series = await tx.timeSeries.create({
          data: {
            name: seriesName,
            source: 'CSV_UPLOAD',
            granularity: result.granularity,
            query,
            geo: null,
            sourceMeta: sourceMeta as Prisma.InputJsonValue,
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
        });

        createdSeries.push({
          id: series.id,
          name: series.name,
          source: series.source,
          granularity: series.granularity,
          query: series.query,
          geo: series.geo,
          pointsCount: result.points.length,
          createdAt: series.createdAt.toISOString(),
          updatedAt: series.updatedAt.toISOString(),
        });
      }
    });

    return NextResponse.json({
      series: createdSeries,
      import: {
        mode: 'CREATE',
        seriesCount: createdSeries.length,
        totalPoints: createdSeries.reduce((sum, s) => sum + s.pointsCount, 0),
      },
    });
  } catch (error) {
    console.error('[kairos] CSV import failed', error);

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
