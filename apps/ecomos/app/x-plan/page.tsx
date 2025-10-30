import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { buildPortalUrl, resolvePortalAuthOrigin } from '@ecom-os/auth'

export default async function XPlanRedirect() {
  const headerList = await headers()
  const forwardedProto = headerList.get('x-forwarded-proto')
  const forwardedHost = headerList.get('x-forwarded-host')
  const host = forwardedHost?.split(',')[0]?.trim() || headerList.get('host')
  const protocol = forwardedProto?.split(',')[0]?.trim() || (host ? 'https' : undefined)

  if (host && protocol) {
    try {
      const origin = `${protocol}://${host}`
      console.log('[x-plan redirect] using headers()', { forwardedProto, forwardedHost, host, protocol, origin })
      const target = new URL('/x-plan', origin)
      redirect(target.toString())
      return
    } catch {
      // fall back to shared helpers
    }
  }

  try {
    const target = buildPortalUrl('/x-plan')
    console.log('[x-plan redirect] using buildPortalUrl fallback')
    redirect(target.toString())
    return
  } catch {
    // fall through to fallback below
  }

  let fallback = 'https://ecomos.targonglobal.com/x-plan'

  try {
    const origin = resolvePortalAuthOrigin()
    fallback = new URL('/x-plan', origin).toString()
  } catch {
    const envBase = process.env.NEXTAUTH_URL || process.env.PORTAL_AUTH_URL || process.env.NEXT_PUBLIC_PORTAL_AUTH_URL
    if (envBase) {
      try {
        fallback = new URL('/x-plan', envBase).toString()
      } catch {
        // retain previous fallback
      }
    }
  }

  redirect(fallback)
}
