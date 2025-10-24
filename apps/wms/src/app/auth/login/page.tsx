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
  const portalAuth = process.env.PORTAL_AUTH_URL || 'https://ecomos.targonglobal.com'
  const rawAppBase = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!rawAppBase) {
    throw new Error('NEXT_PUBLIC_APP_URL must be configured to build WMS login redirects.')
  }

  let appBase: URL
  try {
    appBase = new URL(rawAppBase)
  } catch {
    throw new Error(`NEXT_PUBLIC_APP_URL must be an absolute URL; received "${rawAppBase}".`)
  }

  if (appBase.hostname === 'example.com') {
    throw new Error('NEXT_PUBLIC_APP_URL is still set to example.com; configure the deployed WMS host (e.g., https://ecomos.targonglobal.com/wms).')
  }
  const url = new URL('/login', portalAuth)
  // Pass back the full app URL users should land on after portal login
  if (desired.startsWith('http')) {
    url.searchParams.set('callbackUrl', desired)
  } else {
    const final = new URL(desired, appBase).toString()
    url.searchParams.set('callbackUrl', final)
  }
  redirect(url.toString())
}
