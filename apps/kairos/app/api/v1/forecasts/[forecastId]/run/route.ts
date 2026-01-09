import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withKairosAuth } from '@/lib/api/auth';
import { runForecastNow } from '@/lib/forecasts/run';

const paramsSchema = z.object({
  forecastId: z.string().min(1),
});

export const POST = withKairosAuth(async (_request, session, context: { params: Promise<unknown> }) => {
  const { forecastId } = paramsSchema.parse(await context.params);

  const result = await runForecastNow({ forecastId, session });
  if (!result) {
    return NextResponse.json({ error: 'Forecast not found' }, { status: 404 });
  }

  return NextResponse.json(result);
});
