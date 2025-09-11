import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import LandingPage from '@/components/landing-page'

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (session) {
    // Redirect all authenticated users to unified dashboard
    redirect('/dashboard')
  }

  // Show landing page for non-authenticated users
  return <LandingPage />
}