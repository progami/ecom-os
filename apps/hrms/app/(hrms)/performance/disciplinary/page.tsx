import { redirect } from 'next/navigation'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function DisciplinaryIndexRedirectPage({ searchParams }: PageProps) {
  const rawParams = (await searchParams) ?? {}
  const qp = new URLSearchParams()
  qp.set('caseType', 'VIOLATION')

  const q = rawParams.q
  if (typeof q === 'string' && q.trim()) {
    qp.set('q', q.trim())
  }

  redirect(`/cases?${qp.toString()}`)
}
