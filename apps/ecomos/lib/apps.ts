import fs from 'fs'
import path from 'path'

export type AppDef = {
  id: string
  name: string
  description: string
  url: string
  category: string
  icon?: string
  roles?: string[] // allowed roles (optional). If omitted, all roles allowed
  devPath?: string
  devUrl?: string
}

export const ALL_APPS: AppDef[] = [
  {
    id: 'wms',
    name: 'Warehouse Management',
    description: 'Inbound, outbound, inventory and reporting.',
    url: 'https://ecomos.targonglobal.com/wms',
    category: 'Ops',
    roles: ['admin', 'manager', 'staff']
  },
  {
    id: 'hrms',
    name: 'HRMS',
    description: 'HR, payroll and people operations.',
    url: 'https://hrms.targonglobal.com',
    devPath: '/hrms',
    category: 'HR / Admin',
    roles: ['admin', 'hr']
  },
  {
    id: 'fcc',
    name: 'Finance Console',
    description: 'Financial data, reports and integrations.',
    url: 'https://fcc.targonglobal.com',
    category: 'Finance',
    roles: ['admin', 'finance']
  },
  {
    id: 'website',
    name: 'Website',
    description: 'Marketing website and CMS.',
    url: 'https://www.targonglobal.com',
    category: 'Product',
  },
  {
    id: 'x-plan',
    name: 'X-Plan',
    description: 'Collaborative planning workspace for sales, operations, and finance.',
    url: 'https://ecomos.targonglobal.com/xplan',
    category: 'Product',
    devUrl: 'http://localhost:3008',
  },
  {
    id: 'margin-master',
    name: 'Margin Master',
    description: 'Profitability analytics and sales performance insights.',
    url: 'https://mm.targonglobal.com',
    category: 'Product',
    devUrl: 'http://localhost:3007',
    roles: ['admin', 'marketing', 'viewer'],
  },
  {
    id: 'legal-suite',
    name: 'Legal Suite',
    description: 'Contract repository and compliance workflows.',
    url: 'https://legal.targonglobal.com',
    category: 'Legal',
    devUrl: 'http://localhost:3015',
    roles: ['admin', 'legal'],
  },
]

export function filterAppsForUser(role: string | undefined, allowedAppIds?: string[]) {
  const set = new Set(allowedAppIds ?? [])
  return ALL_APPS.filter(app => {
    const roleOk = !app.roles || (role ? app.roles.includes(role) : true)
    const allowedOk = set.size === 0 || set.has(app.id)
    return roleOk && allowedOk
  })
}

// Development URL resolution (ports from a global root file or env)
type DevConfig = { host?: string; apps?: Record<string, number | string> }

function tryLoadRootDevConfig(): DevConfig | null {
  try {
    // Look for dev.apps.json in likely root locations relative to app cwd
    const candidates = [
      path.resolve(process.cwd(), '../../dev.apps.json'),
      path.resolve(process.cwd(), '../dev.apps.json'),
      path.resolve(process.cwd(), 'dev.apps.json'),
    ]
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8')
        return JSON.parse(raw) as DevConfig
      }
    }
  } catch (_e) {
    // ignore
  }
  return null
}

function getEnvDevUrl(appId: string): string | undefined {
  const keyUrl = `DEV_APP_URL_${appId.toUpperCase()}`
  const keyPortA = `DEV_${appId.toUpperCase()}_PORT`
  const keyPortB = `${appId.toUpperCase()}_PORT`
  if (process.env[keyUrl]) return process.env[keyUrl]
  const host = process.env.DEV_APPS_HOST || 'localhost'
  const port = process.env[keyPortA] || process.env[keyPortB]
  if (port) return `http://${host}:${port}`
  return undefined
}

export function resolveAppUrl(app: AppDef): string {
  if (process.env.NODE_ENV === 'production') {
    return app.url
  }

  let base = getEnvDevUrl(app.id)

  if (!base) {
    const cfg = tryLoadRootDevConfig()
    if (cfg?.apps && app.id in cfg.apps) {
      const val = cfg.apps[app.id]
      const host = cfg.host || 'localhost'
      base = typeof val === 'number' ? `http://${host}:${val}` : typeof val === 'string' ? val : undefined
    }
  }

  if (!base && (process.env.NODE_ENV as string | undefined) !== 'production' && app.devUrl) {
    base = app.devUrl
  }

  if (!base) {
    base = app.url
  }

  if (app.devPath) {
    try {
      const url = new URL(base)
      url.pathname = app.devPath
      return url.toString()
    } catch {}
  }

  return base
}
