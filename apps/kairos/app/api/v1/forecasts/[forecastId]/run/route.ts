import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withKairosAuth } from '@/lib/api/auth';
import { getKairosActor } from '@/lib/access';
import { ForecastAlreadyRunningError, runForecastNow } from '@/lib/forecasts/run';

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

    const result = await runForecastNow({ forecastId, session });
    if (!result) {
      return NextResponse.json({ error: 'Forecast not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ForecastAlreadyRunningError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : 'Run failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
