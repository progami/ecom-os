import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ id: string }>
}

export default async function PolicyEditRedirectPage({ params }: Props) {
  const { id } = await params
  redirect(`/policies/${id}`)
}
