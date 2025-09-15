export type AppCode = 'wms' | 'hrms' | 'fcc' | 'website'

export type UserRecord = {
  id: string
  email: string
  name?: string | null
  role?: string | null // legacy/global role if available
}

export type AppEntitlement = {
  role: string
  depts?: string[]
}

export type RolesClaim = Record<string, AppEntitlement>

// Simple example policy: map a user's global role to per-app entitlements.
// Replace with DB-backed entitlements and admin UI later.
export function getUserEntitlements(user: UserRecord): RolesClaim {
  const isAdmin = (user.role || '').toLowerCase() === 'admin'
  const roles: RolesClaim = {}

  if (isAdmin) {
    roles['wms'] = { role: 'admin', depts: ['finance','ops'] }
    roles['fcc'] = { role: 'admin', depts: ['finance'] }
    roles['hrms'] = { role: 'admin', depts: ['hr'] }
  } else {
    // Default staff with minimal departments; tune per business rules
    roles['wms'] = { role: 'staff', depts: ['ops'] }
    roles['fcc'] = { role: 'viewer', depts: ['finance'] }
    // hrms optional
  }

  return roles
}

