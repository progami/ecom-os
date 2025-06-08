import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  // Redirect based on user role
  switch (session.user.role) {
    case 'staff':
      redirect('/dashboard')
    case 'admin':
      redirect('/admin/dashboard')
    default:
      redirect('/dashboard')
  }
}