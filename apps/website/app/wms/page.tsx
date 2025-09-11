import { redirect } from 'next/navigation'

export default async function WMSPage() {
  // Redirect directly to WMS login page
  // The WMS login has credentials pre-filled and will redirect to admin/dashboard
  redirect('http://localhost:3002/auth/login')
}