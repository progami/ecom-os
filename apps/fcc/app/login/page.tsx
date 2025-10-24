import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const portalAuth = process.env.PORTAL_AUTH_URL || 'https://ecomos.targonglobal.com'
  const url = new URL('/login', portalAuth)
  url.searchParams.set('callbackUrl', process.env.NEXT_PUBLIC_APP_URL || '')
  redirect(url.toString())
}
