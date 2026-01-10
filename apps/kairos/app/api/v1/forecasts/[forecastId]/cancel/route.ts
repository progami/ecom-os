import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withKairosAuth } from '@/lib/api/auth';
import prisma from '@/lib/prisma';
import { buildKairosOwnershipWhere, getKairosActor } from '@/lib/access';

const paramsSchema = z.object({
  forecastId: z.string().min(1),
});

export const POST = withKairosAuth(async (_request, session, context: { params: Promise<unknown> }) => {
  try {
    const rawParams = await context.params;
    const safeParams =
      rawParams && typeof rawParams === 'object'
        ? { ...(rawParams as Record<string, unknown>), then: undefined }
        : rawParams;

    const { forecastId } = paramsSchema.parse(safeParams);

    const actor = getKairosActor(session);
    if (!actor.id && !actor.email) {
      return NextResponse.json({ error: 'User identity is missing.' }, { status: 403 });
    }

    const cancelledAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const forecast = await tx.forecast.findFirst({
        where: {
          id: forecastId,
          ...buildKairosOwnershipWhere(actor),
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!forecast) {
        return { kind: 'not_found' as const };
      }

      if (forecast.status !== 'RUNNING') {
        return { kind: 'not_running' as const, status: forecast.status };
      }

      const run = await tx.forecastRun.findFirst({
        where: { forecastId: forecast.id, status: 'RUNNING' },
        orderBy: { ranAt: 'desc' },
        select: { id: true },
      });

      if (run) {
        await tx.forecastRun.updateMany({
          where: { id: run.id, status: 'RUNNING' },
          data: { status: 'FAILED', errorMessage: 'Cancelled by user.' },
        });
      }

      await tx.forecast.updateMany({
        where: { id: forecast.id, status: 'RUNNING' },
        data: { status: 'FAILED', lastRunAt: cancelledAt },
      });

      return {
        kind: 'cancelled' as const,
        forecast: {
          id: forecast.id,
          status: 'FAILED',
          lastRunAt: cancelledAt.toISOString(),
        },
        run: run ? { id: run.id, status: 'FAILED' } : null,
      };
    });

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Forecast not found' }, { status: 404 });
    }

    if (result.kind === 'not_running') {
      return NextResponse.json({ error: `Forecast is not running (status: ${result.status}).` }, { status: 409 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.at(0)?.message ?? 'Invalid request.' },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : 'Cancel failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

