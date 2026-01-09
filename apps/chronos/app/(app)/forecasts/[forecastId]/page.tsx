import { ForecastDetailView } from '@/components/forecasts/forecast-detail';

export default async function ForecastDetailPage({
  params,
}: {
  params: Promise<{ forecastId: string }>;
}) {
  const { forecastId } = await params;
  return <ForecastDetailView forecastId={forecastId} />;
}
