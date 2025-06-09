import { redirect } from 'next/navigation'

export default function WMSPage() {
  // Redirect to dashboard by default
  redirect('/wms/dashboard')
}