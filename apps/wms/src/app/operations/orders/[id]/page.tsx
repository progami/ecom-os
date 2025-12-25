import { redirect } from 'next/navigation'

export default function OrderRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/operations/purchase-orders/${params.id}`)
}
