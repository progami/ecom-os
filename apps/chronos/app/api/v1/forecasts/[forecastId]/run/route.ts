import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withChronosAuth } from '@/lib/api/auth';
import { runForecastNow } from '@/lib/forecasts/run';

const paramsSchema = z.object({
  forecastId: z.string().min(1),
});

export const POST = withChronosAuth(async (_request, session, context: { params: unknown }) => {
  const { forecastId } = paramsSchema.parse(context.params);

  const result = await runForecastNow({ forecastId, session });
  if (!result) {
    return NextResponse.json({ error: 'Forecast not found' }, { status: 404 });
  }

  return NextResponse.json(result);
});

