import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const central = process.env.CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com'
  const url = new URL('/login', central)
  url.searchParams.set('callbackUrl', process.env.NEXT_PUBLIC_APP_URL || '')
  redirect(url.toString())
}
