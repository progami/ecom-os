import { redirect } from 'next/navigation'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const params = await searchParams
  const query = params?.year ? `?year=${params.year}` : ''
  redirect(`/0-strategies${query}`)
}
