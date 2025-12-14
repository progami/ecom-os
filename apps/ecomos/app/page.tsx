import { redirect } from 'next/navigation'
import { filterAppsForUser, resolveAppUrl, ALL_APPS } from '@/lib/apps'
import { getSafeServerSession } from '@/lib/safe-session'
import PortalClient from './PortalClient'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function PortalHome({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSafeServerSession()
  if (!session) {
    redirect('/login')
  }

  const params = await searchParams
  const errorCode = typeof params.error === 'string' ? params.error : undefined
  const errorApp = typeof params.app === 'string' ? params.app : undefined

  let accessError: string | undefined
  if (errorCode === 'no_access' && errorApp) {
    const appDef = ALL_APPS.find(a => a.id === errorApp)
    const appName = appDef?.name ?? errorApp
    accessError = `You don't have access to ${appName}. Contact an administrator if you need access.`
  }

  const rolesClaim = (session as any).roles as Record<string, { role: string; depts?: string[] }> | undefined
  const allowedAppIds = rolesClaim ? Object.keys(rolesClaim) : []
  const apps = filterAppsForUser(allowedAppIds)

  // Resolve URLs on the server side so the client never sees placeholder slugs or stale hosts
  const appsWithUrls = apps.map(app => ({
    ...app,
    url: resolveAppUrl(app)
  }))

  return (
    <PortalClient
      session={session}
      apps={appsWithUrls}
      roles={rolesClaim}
      accessError={accessError}
    />
  )
}
