import { Suspense } from 'react'
import { CasesClientPage } from './CasesClientPage'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstString(input: string | string[] | undefined): string | null {
  if (!input) return null
  if (Array.isArray(input)) return input[0] ?? null
  return input
}

export default async function CasesPage({ searchParams }: PageProps) {
  const rawParams = (await searchParams) ?? {}

  const initialTabRaw = firstString(rawParams.caseType) ?? firstString(rawParams.tab) ?? undefined
  const initialQueryRaw = firstString(rawParams.q) ?? undefined

  return (
    <Suspense>
      <CasesClientPage initialTab={initialTabRaw} initialQuery={initialQueryRaw} />
    </Suspense>
  )
}
