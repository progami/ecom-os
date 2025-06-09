import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export default async function WMSPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/wms/auth/login')
  }

  // Redirect based on user role
  switch (session.user.role) {
    case 'staff':
      redirect('/wms/dashboard')
    case 'admin':
      redirect('/wms/admin/dashboard')
    default:
      redirect('/wms/dashboard')
  }
}