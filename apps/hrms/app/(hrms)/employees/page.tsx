import { Suspense } from 'react'
import { EmployeesClientPage } from './EmployeesClientPage'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstString(input: string | string[] | undefined): string | null {
  if (!input) return null
  if (Array.isArray(input)) return input[0] ?? null
  return input
}

export default async function EmployeesPage({ searchParams }: PageProps) {
  const rawParams = (await searchParams) ?? {}
  const initialQueryRaw = firstString(rawParams.q) ?? undefined

  return (
    <Suspense>
      <EmployeesClientPage initialQuery={initialQueryRaw} />
    </Suspense>
  )
}
