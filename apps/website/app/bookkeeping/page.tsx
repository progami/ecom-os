import { redirect } from 'next/navigation'

export default function BookkeepingPage() {
  // Redirect to bookkeeping app running on port 3003
  redirect('http://localhost:3003')
}