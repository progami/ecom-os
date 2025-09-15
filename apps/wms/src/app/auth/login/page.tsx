import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function LoginPage({ searchParams }: { searchParams?: { callbackUrl?: string } }) {
  // Read sync dynamic API (searchParams) before any await to satisfy Next.js constraints
  const desired = (searchParams?.callbackUrl as string | undefined) || '/dashboard'
  const session = await getServerSession(authOptions)
  if (session) {
    redirect(desired)
  }
  const central = process.env.CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com'
  const appBase = process.env.NEXT_PUBLIC_APP_URL || ''
  const url = new URL('/login', central)
  // Pass back the full app URL users should land on after central login
  if (desired.startsWith('http')) {
    url.searchParams.set('callbackUrl', desired)
  } else {
    const final = appBase ? new URL(desired, appBase).toString() : desired
    url.searchParams.set('callbackUrl', final)
  }
  redirect(url.toString())
}
