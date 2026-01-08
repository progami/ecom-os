import { redirect } from 'next/navigation'

type Props = { params: Promise<{ id: string }> }

export default async function LeaveRedirectPage({ params }: Props) {
  const { id } = await params
  redirect(`/leaves/${id}`)
}

