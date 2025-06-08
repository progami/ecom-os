import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect to WMS dashboard
  redirect('/wms/dashboard')
}