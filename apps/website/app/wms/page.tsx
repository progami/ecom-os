import { redirect } from 'next/navigation'

export default async function TalosPage() {
  // Redirect directly to the Talos login page.
  // The login has credentials pre-filled and will redirect to the dashboard.
  redirect('http://localhost:3002/auth/login')
}
