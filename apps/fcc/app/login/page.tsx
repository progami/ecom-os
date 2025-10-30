import { redirect } from 'next/navigation'
import { portalUrl } from '@/lib/portal'

export default async function LoginPage() {
  const url = portalUrl('/login')
  url.searchParams.set('callbackUrl', process.env.NEXT_PUBLIC_APP_URL || '')
  redirect(url.toString())
}
