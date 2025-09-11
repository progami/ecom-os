import { redirect } from 'next/navigation'

export default function TransactionsIndexPage() {
  // Redirect to inventory page as transactions are viewed there
  redirect('/operations/inventory')
}