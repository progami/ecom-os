import { redirect } from 'next/navigation'
import { ALL_APPS, resolveAppUrl } from '@/lib/apps'
import { getSafeServerSession } from '@/lib/safe-session'
import PortalClient from './PortalClient'

export default async function PortalHome() {
  const session = await getSafeServerSession()
  if (!session) {
    redirect('/login')
  }

  const rolesClaim = (session as any).roles as Record<string, { role: string; depts?: string[] }> | undefined

  const normalizedRoles = rolesClaim ? { ...rolesClaim } : undefined
  const userRole = (session.user as { role?: string } | undefined)?.role
  if (normalizedRoles && userRole === 'admin') {
    if (!normalizedRoles['margin-master']) {
      normalizedRoles['margin-master'] = { role: 'admin', depts: ['Product'] }
    }
    if (!normalizedRoles['x-plan']) {
      normalizedRoles['x-plan'] = { role: 'admin', depts: ['Product'] }
    }
    if (!normalizedRoles['legal-suite']) {
      normalizedRoles['legal-suite'] = { role: 'admin', depts: ['Legal'] }
    }
  }

  const apps = normalizedRoles ? ALL_APPS.filter((a) => normalizedRoles[a.id] && a.lifecycle !== 'archive') : []

  // Resolve URLs on the server side so the client never sees placeholder slugs or stale hosts
  const appsWithUrls = apps.map(app => ({
    ...app,
    url: resolveAppUrl(app)
  }))

  return (
    <PortalClient
      session={session}
      apps={appsWithUrls}
      roles={normalizedRoles}
    />
  )
}
