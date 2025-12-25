import { redirect } from 'next/navigation'

export default function NewOrdersRedirectPage() {
  redirect('/operations/purchase-orders/new')
}
