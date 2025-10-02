import { redirect } from 'next/navigation'
import { loadPlanningCalendar, resolveActiveYear } from '@/lib/planning'

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [planningCalendar, rawSearchParams] = await Promise.all([
    loadPlanningCalendar(),
    searchParams ?? Promise.resolve({}),
  ])

  const parsedSearch = rawSearchParams as Record<string, string | string[] | undefined>
  const activeYear = resolveActiveYear(parsedSearch.year, planningCalendar.yearSegments)

  const params = new URLSearchParams()
  Object.entries(parsedSearch).forEach(([key, value]) => {
    if (value == null) return
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item != null) params.append(key, String(item))
      })
      return
    }
    params.set(key, String(value))
  })

  if (activeYear == null) {
    params.delete('year')
  } else {
    params.set('year', String(activeYear))
  }

  const query = params.toString()
  const href = query ? `/sheet/1-product-setup?${query}` : '/sheet/1-product-setup'

  redirect(href)
}
