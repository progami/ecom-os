import { redirect } from 'next/navigation'

export default async function DisciplinaryEditRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/cases/violations/${encodeURIComponent(id)}/edit`)
}
