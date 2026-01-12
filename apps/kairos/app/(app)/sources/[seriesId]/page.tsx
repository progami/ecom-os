import { DataSourceDetail } from '@/components/sources/data-source-detail';

export default async function DataSourceDetailPage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;
  return <DataSourceDetail seriesId={seriesId} />;
}
