import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ id: string }>
}

export default async function DisciplinaryEditRedirectPage({ params }: Props) {
  const { id } = await params
  redirect(`/performance/violations/${id}`)
}
