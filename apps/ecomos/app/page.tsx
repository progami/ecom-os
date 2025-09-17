import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ALL_APPS, resolveAppUrl } from '@/lib/apps'
import PortalClient from './PortalClient'

export default async function PortalHome() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  const roles = (session as any).roles as Record<string, { role: string, depts?: string[] }> | undefined
  const apps = roles ? ALL_APPS.filter(a => roles[a.id]) : []

  // Resolve URLs on the server side
  const appsWithUrls = apps.map(app => ({
    ...app,
    url: resolveAppUrl(app)
  }))

  return (
    <PortalClient
      session={session}
      apps={appsWithUrls}
      roles={roles}
    />
  )
}
