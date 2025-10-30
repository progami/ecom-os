import { redirect } from 'next/navigation'

export default function XPlanRedirect() {
  const portalBase = process.env.NEXTAUTH_URL || process.env.PORTAL_AUTH_URL || process.env.NEXT_PUBLIC_PORTAL_AUTH_URL
  let target: string | null = null

  if (portalBase) {
    try {
      const url = new URL(portalBase)
      const host = url.hostname
      if (host === 'ecomos.targonglobal.com') {
        target = 'https://x-plan.targonglobal.com'
      } else if (host.endsWith('.ecomos.targonglobal.com')) {
        target = `https://${host.replace('.ecomos.targonglobal.com', '.x-plan.targonglobal.com')}${url.pathname}`
      }
    } catch {
      // fall back below
    }
  }

  redirect(target ?? 'https://x-plan.targonglobal.com')
}
