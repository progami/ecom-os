import { redirect } from 'next/navigation'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function DisciplinaryAddRedirectPage({ searchParams }: PageProps) {
  const rawParams = (await searchParams) ?? {}

  const qp = new URLSearchParams()
  const employeeId = rawParams.employeeId
  if (typeof employeeId === 'string' && employeeId.trim()) {
    qp.set('employeeId', employeeId.trim())
  }

  redirect(`/cases/violations/add${qp.toString() ? `?${qp.toString()}` : ''}`)
}

