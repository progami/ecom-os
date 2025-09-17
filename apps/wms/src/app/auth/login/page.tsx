import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

type SearchParamsInput =
  | { callbackUrl?: string }
  | Promise<{ callbackUrl?: string } | undefined>
  | undefined

export default async function LoginPage({ searchParams }: { searchParams?: SearchParamsInput }) {
  const resolved = await Promise.resolve(searchParams)
  const desired = typeof resolved?.callbackUrl === 'string' && resolved.callbackUrl.trim().length > 0
    ? resolved.callbackUrl
    : '/dashboard'

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
